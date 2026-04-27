-- 043_workflow_unenrolled_function.sql
--
-- Teaches get_campaign_recipients about the `workflow_unenrolled` event
-- added in 042. Split from 042 because Postgres can't use a just-added
-- enum value inside the same transaction that added it (the SQL function
-- body parses all string-to-enum comparisons at creation time).
--
-- Severity ordering for workflow contacts is now:
--   unsubscribed > complained > bounced > workflow_enroll_failed (→failed) >
--   workflow_unenrolled (→unenrolled) > clicked > opened > delivered >
--   workflow_enrolled (→enrolled) > unknown
--
-- "unenrolled" wins over "enrolled" so a contact who was removed
-- (workflow_enrolled THEN workflow_unenrolled) shows as unenrolled rather
-- than as still-enrolled.

create or replace function get_campaign_recipients(
  p_campaign_id uuid,
  p_status text default null,
  p_search text default null,
  p_page_size int default 25,
  p_page int default 1
)
returns table(
  contact_id uuid,
  ghl_contact_id text,
  full_name text,
  email text,
  status text,
  last_activity_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  last_click_url text,
  total_count bigint
)
language sql
security definer
stable
as $$
  with
    clamp as (
      select
        greatest(least(coalesce(p_page_size, 25), 500), 1) as sz,
        greatest(coalesce(p_page, 1), 1) as pg
    ),
    per_contact as (
      select
        e.contact_id,
        max(e.ghl_contact_id) as ghl_contact_id,
        case
          when bool_or(e.event_type = 'unsubscribed')             then 'unsubscribed'
          when bool_or(e.event_type = 'complained')               then 'complained'
          when bool_or(e.event_type = 'bounced')                  then 'bounced'
          when bool_or(e.event_type = 'workflow_enroll_failed')   then 'failed'
          when bool_or(e.event_type = 'workflow_unenrolled')      then 'unenrolled'
          when bool_or(e.event_type = 'clicked')                  then 'clicked'
          when bool_or(e.event_type = 'opened')                   then 'opened'
          when bool_or(e.event_type = 'delivered')                then 'delivered'
          when bool_or(e.event_type = 'workflow_enrolled')        then 'enrolled'
          else 'unknown'
        end as status,
        max(e.occurred_at) as last_activity_at,
        max(e.occurred_at) filter (where e.event_type = 'delivered') as delivered_at,
        max(e.occurred_at) filter (where e.event_type = 'opened')    as opened_at,
        max(e.occurred_at) filter (where e.event_type = 'clicked')   as clicked_at,
        (
          array_agg(e.metadata->>'url' order by e.occurred_at desc)
            filter (where e.event_type = 'clicked' and e.metadata->>'url' is not null)
        )[1] as last_click_url
      from marketing_events e
      where e.campaign_id = p_campaign_id
        and coalesce(e.metadata->>'is_test', 'false') <> 'true'
        and e.contact_id is not null
      group by e.contact_id
    ),
    joined as (
      select
        pc.contact_id,
        pc.ghl_contact_id,
        c.full_name,
        c.email,
        pc.status,
        pc.last_activity_at,
        pc.delivered_at,
        pc.opened_at,
        pc.clicked_at,
        pc.last_click_url
      from per_contact pc
      left join marketing_contacts c on c.id = pc.contact_id
    ),
    filtered as (
      select *
      from joined
      where
        (p_status is null or status = p_status)
        and (
          p_search is null
          or p_search = ''
          or full_name ilike '%' || p_search || '%'
          or email ilike '%' || p_search || '%'
        )
    ),
    counted as (
      select count(*)::bigint as total_count from filtered
    )
  select
    f.contact_id,
    f.ghl_contact_id,
    f.full_name,
    f.email,
    f.status,
    f.last_activity_at,
    f.delivered_at,
    f.opened_at,
    f.clicked_at,
    f.last_click_url,
    (select total_count from counted)
  from filtered f, clamp
  order by f.last_activity_at desc nulls last, f.email asc
  limit (select sz from clamp)
  offset (select (pg - 1) * sz from clamp);
$$;

grant execute on function get_campaign_recipients(uuid, text, text, int, int)
  to authenticated, service_role;

-- ------------------------------------------------
-- still_enrolled_contacts(p_campaign_id)
-- ------------------------------------------------
-- Returns the contact_ids whose most-recent workflow event for this
-- campaign is `workflow_enrolled` (i.e. not later unenrolled). Used by
-- POST /api/marketing/campaigns/[id]/unenroll when body is { all: true }
-- to avoid pulling every event into Node just to filter it.
--
-- Ties on occurred_at break by event_type, with 'workflow_unenrolled'
-- winning — protects against the (unlikely) case where a manual unenroll
-- lands in the same millisecond as the enrol.
create or replace function still_enrolled_contacts(p_campaign_id uuid)
returns table(contact_id uuid)
language sql
security definer
stable
as $$
  with ranked as (
    select
      e.contact_id,
      e.event_type,
      row_number() over (
        partition by e.contact_id
        order by e.occurred_at desc,
          case when e.event_type = 'workflow_unenrolled' then 0 else 1 end
      ) as rn
    from marketing_events e
    where e.campaign_id = p_campaign_id
      and e.event_type in ('workflow_enrolled', 'workflow_unenrolled')
      and e.contact_id is not null
      and coalesce(e.metadata->>'is_test', 'false') <> 'true'
  )
  select contact_id
  from ranked
  where rn = 1
    and event_type = 'workflow_enrolled';
$$;

grant execute on function still_enrolled_contacts(uuid)
  to authenticated, service_role;
