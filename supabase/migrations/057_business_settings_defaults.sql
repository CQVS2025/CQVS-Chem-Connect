-- Migration 057: seed default values for business settings.
--
-- These keys drive order math (tax rate, Stripe processing fee, currency,
-- minimum order value). Without seeded rows the calculator falls back to
-- hardcoded defaults; seeding lets admin see the current values in the
-- /admin/settings UI immediately after a fresh install.
--
-- All idempotent - on conflict, do nothing so re-running the migration
-- never overwrites admin's saved values.

insert into admin_settings (key, value)
values
  ('tax_rate',           '10'),    -- 10% GST
  ('currency',           'AUD'),
  ('stripe_fee_percent', '1.75'),  -- 1.75%
  ('stripe_fee_fixed',   '0.30'),  -- $0.30 fixed per transaction
  ('stripe_fee_gst',     '10'),    -- 10% GST on the Stripe fee
  ('min_order_value',    '100')    -- $100 platform minimum
on conflict (key) do nothing;
