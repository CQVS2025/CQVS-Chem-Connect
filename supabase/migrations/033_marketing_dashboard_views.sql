-- ============================================
-- Marketing dashboard materialised views
-- ============================================
-- These drive the Marketing > Dashboard widgets. Built as views so they
-- always return fresh numbers; if we ever hit scale issues we swap to
-- materialised views + refresh triggers without changing the reader.

-- Monthly stats: counts of campaigns and sent events in the current month.
create or replace view marketing_dashboard_month as
select
  count(*) filter (
    where type = 'email' and sent_at >= date_trunc('month', now())
  ) as emails_sent_this_month,
  count(*) filter (
    where type = 'sms' and sent_at >= date_trunc('month', now())
  ) as sms_sent_this_month,
  coalesce(sum(delivered_count) filter (
    where sent_at >= date_trunc('month', now())
  ), 0) as delivered_this_month,
  coalesce(sum(opened_count) filter (
    where sent_at >= date_trunc('month', now())
  ), 0) as opened_this_month,
  coalesce(sum(clicked_count) filter (
    where sent_at >= date_trunc('month', now())
  ), 0) as clicked_this_month,
  count(*) filter (where status = 'sending') as active_campaigns,
  count(*) filter (where status = 'scheduled') as scheduled_campaigns
from marketing_campaigns;

-- Recent campaigns, denormalised with quick rates for the dashboard table.
create or replace view marketing_dashboard_recent_campaigns as
select
  id,
  name,
  type,
  status,
  audience_count,
  delivered_count,
  opened_count,
  clicked_count,
  case
    when delivered_count > 0 then
      round(100.0 * opened_count / delivered_count, 1)
    else 0
  end as open_rate,
  case
    when delivered_count > 0 then
      round(100.0 * clicked_count / delivered_count, 1)
    else 0
  end as click_rate,
  sent_at,
  scheduled_at,
  created_at
from marketing_campaigns
order by coalesce(sent_at, scheduled_at, created_at) desc;

-- Unread inbox badge for nav / dashboard.
create or replace view marketing_dashboard_inbox as
select
  count(*) filter (where unread_count > 0) as unread_threads,
  coalesce(sum(unread_count), 0) as unread_messages
from sms_conversations;

-- Contacts snapshot: total / new this week / opted-out.
create or replace view marketing_dashboard_contacts as
select
  count(*) filter (where deleted_at is null) as total_contacts,
  count(*) filter (
    where deleted_at is null
      and created_at >= now() - interval '7 days'
  ) as new_this_week,
  count(*) filter (
    where deleted_at is null and is_opted_out = true
  ) as opted_out
from marketing_contacts;

-- Grant select to authenticated (RLS already protects the underlying tables).
grant select on marketing_dashboard_month to authenticated;
grant select on marketing_dashboard_recent_campaigns to authenticated;
grant select on marketing_dashboard_inbox to authenticated;
grant select on marketing_dashboard_contacts to authenticated;
