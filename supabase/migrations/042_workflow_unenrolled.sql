-- 042_workflow_unenrolled.sql
--
-- Adds the `workflow_unenrolled` marketing event type for recording when an
-- admin manually removes a contact from an in-flight GHL workflow drip.
-- Also adds an `unenrolled_count` tally to marketing_campaigns so the UI
-- can show "10 enrolled / 2 removed" without re-aggregating events.
--
-- The event type addition MUST live in its own migration: Postgres rejects
-- using a just-added enum value inside the same transaction that added it,
-- and the function update that references it comes in 043.
--
-- Re-runnable.

alter type marketing_event_type add value if not exists 'workflow_unenrolled';

alter table marketing_campaigns
  add column if not exists unenrolled_count integer not null default 0;
