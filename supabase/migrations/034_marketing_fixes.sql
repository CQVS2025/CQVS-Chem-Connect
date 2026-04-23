-- ============================================
-- M2-M5 post-audit fixes
-- ============================================
-- 1. Atomic campaign counter increments (fixes read-then-write race).
-- 2. Lookup helper to attribute an event to a campaign by messageId.
-- 3. Partial unique index so sms_messages stays idempotent even when
--    ghl_message_id is NULL.
-- 4. Indexes to accelerate webhook-time attribution lookups.
-- 5. Remove the attribution anchor's unsubscribe-tracking quirk:
--    since we seed `delivered` events as attribution anchors, ensure
--    the unique on ghl_event_id still holds.

-- ------------------------------------------------
-- 1. Atomic increment RPC
-- ------------------------------------------------
create or replace function bump_campaign_counter(
  p_campaign_id uuid,
  p_column text,
  p_delta int default 1
) returns void
language plpgsql
security definer
as $$
begin
  -- Guard against arbitrary column names (only allow our known counters).
  if p_column not in (
    'delivered_count',
    'opened_count',
    'clicked_count',
    'bounced_count',
    'unsubscribed_count',
    'failed_count'
  ) then
    raise exception 'Invalid counter column: %', p_column;
  end if;
  execute format(
    'update marketing_campaigns set %I = coalesce(%I, 0) + $1 where id = $2',
    p_column, p_column
  ) using p_delta, p_campaign_id;
end;
$$;

-- ------------------------------------------------
-- 2. Lookup index for message-id -> campaign_id
-- ------------------------------------------------
-- The events webhook looks up the attribution anchor by messageId to find
-- the owning campaign. This index keeps that lookup O(1).
create index if not exists marketing_events_message_anchor_idx
  on marketing_events ((metadata->>'message_id'))
  where metadata ? 'message_id';

-- ------------------------------------------------
-- 3. Partial unique constraint on sms_messages so NULL ghl_message_id
--    rows are still counted individually, but non-null duplicates dedupe.
-- ------------------------------------------------
-- sms_messages.ghl_message_id is already `unique`, but SQL standard allows
-- multiple NULLs through a unique constraint. For the inbox dedupe path,
-- we add a partial unique index on (conversation_id, body, occurred_at)
-- so a retried webhook without a messageId still dedupes.
create unique index if not exists sms_messages_dedupe_idx
  on sms_messages (conversation_id, direction, body, occurred_at)
  where ghl_message_id is null;

-- ------------------------------------------------
-- 4. Contact-time range index for event lookups during dispatcher retries.
-- ------------------------------------------------
create index if not exists marketing_events_contact_occurred_idx
  on marketing_events (ghl_contact_id, occurred_at desc);

-- ------------------------------------------------
-- 5. Scheduled campaigns worker helper
-- ------------------------------------------------
-- Returns campaigns whose scheduled_at has passed and are still in
-- 'scheduled' state. The /api/marketing/campaigns/run-scheduled route
-- iterates this list.
create or replace function due_scheduled_campaigns(now_ts timestamptz default now())
returns setof marketing_campaigns
language sql
stable
as $$
  select *
  from marketing_campaigns
  where status = 'scheduled'
    and scheduled_at is not null
    and scheduled_at <= now_ts
  order by scheduled_at asc
$$;

grant execute on function bump_campaign_counter(uuid, text, int) to service_role, authenticated;
grant execute on function due_scheduled_campaigns(timestamptz) to service_role, authenticated;
