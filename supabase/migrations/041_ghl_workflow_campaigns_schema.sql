-- 041_ghl_workflow_campaigns_schema.sql
--
-- Adds the columns, indexes, and function tweaks that USE the enum values
-- introduced in 040. Split from 040 because Postgres rejects using a
-- just-added enum value inside the same transaction that added it.
--
-- Re-runnable.

-- 1. Columns on marketing_campaigns to reference a GHL workflow and keep a
--    running enrolment tally for the UI. `ghl_workflow_name` is a cached
--    display label so the campaign list can render without re-hitting GHL.
--    The ID is the source of truth — if the admin renames the workflow in
--    GHL, the cached name goes stale but enrolments still hit the right flow.
alter table marketing_campaigns
  add column if not exists ghl_workflow_id text,
  add column if not exists ghl_workflow_name text,
  add column if not exists enrolled_count integer not null default 0;

-- Lookup by workflow when we want to surface "which campaigns enrolled
-- contacts into this workflow". Partial index keeps it cheap for
-- non-workflow campaigns.
create index if not exists marketing_campaigns_workflow_idx
  on marketing_campaigns (ghl_workflow_id)
  where ghl_workflow_id is not null;

-- 2. Teach get_campaign_recipients about workflow enrolment events so the
--    analytics recipient table shows "enrolled" instead of "unknown" for
--    contacts we pushed into a GHL workflow. Severity ordering (highest
--    wins) is:
--      unsubscribed > complained > bounced > workflow_enroll_failed >
--      clicked > opened > delivered > workflow_enrolled > unknown
--    Failed workflow enrolments map to the existing "failed" status so the
--    same filter chip works across all three channels.
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
