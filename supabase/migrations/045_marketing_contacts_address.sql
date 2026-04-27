-- 045_marketing_contacts_address.sql
--
-- Adds the address fields that GHL already returns on every contact but
-- which the mirror was silently dropping. Backfill: the mirror will populate
-- these on the next webhook touch, or run the chunked re-sync from the
-- Marketing > Contacts page to fill them all at once.
--
-- Re-runnable via IF NOT EXISTS.

alter table marketing_contacts
  add column if not exists city text,
  add column if not exists address1 text,
  add column if not exists postal_code text;
