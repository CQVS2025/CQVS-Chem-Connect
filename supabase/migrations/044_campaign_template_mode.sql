-- 044_campaign_template_mode.sql
--
-- Adds `template_mode` to marketing_campaigns so we can distinguish how
-- the email body was rendered:
--   'plain'       — minimal HTML wrapper, no CQVS header/colors/footer.
--                   Looks like a normal personal email. Default for new
--                   campaigns per client preference.
--   'branded'     — full CQVS template (dark header, teal accent, footer).
--                   Existing campaigns are backfilled to this since their
--                   body_html is already wrapped in the branded shell.
--   'custom_html' — user pasted full HTML; we ship it untouched.
--
-- The wrapping happens client-side in the wizard before save, so this
-- column is metadata only (analytics, detail-page badge). The dispatcher
-- still sends body_html verbatim.
--
-- Re-runnable via IF NOT EXISTS / DO blocks.

alter table marketing_campaigns
  add column if not exists template_mode text not null default 'branded';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketing_campaigns_template_mode_check'
  ) then
    alter table marketing_campaigns
      add constraint marketing_campaigns_template_mode_check
      check (template_mode in ('plain', 'branded', 'custom_html'));
  end if;
end$$;
