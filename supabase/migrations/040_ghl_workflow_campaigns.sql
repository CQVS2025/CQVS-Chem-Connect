-- 040_ghl_workflow_campaigns.sql
--
-- Adds enum values used by the new "ghl_workflow" campaign type. Enum
-- additions MUST live in their own migration file because Postgres does
-- not allow a newly-added enum value to be referenced in the same
-- transaction that created it. The columns and SQL functions that use
-- these values live in 041_ghl_workflow_campaigns_schema.sql.
--
-- Re-runnable via IF NOT EXISTS.

-- Third campaign channel alongside email and sms.
alter type marketing_campaign_type add value if not exists 'ghl_workflow';

-- Per-recipient outcomes when enrolling into a GHL workflow.
alter type marketing_event_type add value if not exists 'workflow_enrolled';
alter type marketing_event_type add value if not exists 'workflow_enroll_failed';
