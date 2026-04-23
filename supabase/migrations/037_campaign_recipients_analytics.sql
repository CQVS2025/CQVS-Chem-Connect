-- ============================================
-- get_campaign_recipients
-- ============================================
-- Per-campaign "who did what" analytics. Collapses all marketing_events
-- for a campaign into one row per recipient, annotated with the most
-- significant status they reached and when.
--
-- Severity order (lowest -> highest, highest wins):
--   delivered < opened < clicked < bounced < complained < unsubscribed
--
-- Test-send events (metadata.is_test = true) are filtered out so the
-- analytics page reflects the real audience, not your own previews.
--
-- Arguments:
--   p_campaign_id  — campaign to report on
--   p_status       — optional filter: 'opened', 'clicked', etc. Matches the
--                    derived status, not any raw event_type.
--   p_search       — optional case-insensitive ILIKE across name + email
--   p_page_size    — rows per page, clamped 1..500
--   p_page         — 1-based page number
--
-- Returns one row per contact plus a `total_count` that's the same on
-- every row (lets the caller show "X of N" without a second query).

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
          when bool_or(e.event_type = 'unsubscribed') then 'unsubscribed'
          when bool_or(e.event_type = 'complained')  then 'complained'
          when bool_or(e.event_type = 'bounced')     then 'bounced'
          when bool_or(e.event_type = 'clicked')     then 'clicked'
          when bool_or(e.event_type = 'opened')      then 'opened'
          when bool_or(e.event_type = 'delivered')   then 'delivered'
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

-- Aggregate metrics helper — reads the live marketing_events table rather
-- than the cached counters on marketing_campaigns, so the analytics page
-- always reflects current reality (catches drift if counters somehow lag).
create or replace function get_campaign_metrics(p_campaign_id uuid)
returns table(
  audience int,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  complained bigint,
  unsubscribed bigint,
  failed bigint
)
language sql
security definer
stable
as $$
  select
    coalesce(c.audience_count, 0),
    count(distinct e.contact_id) filter (where e.event_type = 'delivered'),
    count(distinct e.contact_id) filter (where e.event_type = 'opened'),
    count(distinct e.contact_id) filter (where e.event_type = 'clicked'),
    count(distinct e.contact_id) filter (where e.event_type = 'bounced'),
    count(distinct e.contact_id) filter (where e.event_type = 'complained'),
    count(distinct e.contact_id) filter (where e.event_type = 'unsubscribed'),
    count(distinct e.contact_id) filter (where e.event_type = 'failed')
  from marketing_campaigns c
  left join marketing_events e
    on e.campaign_id = c.id
    and coalesce(e.metadata->>'is_test', 'false') <> 'true'
  where c.id = p_campaign_id
  group by c.audience_count;
$$;

grant execute on function get_campaign_metrics(uuid)
  to authenticated, service_role;
