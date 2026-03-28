-- Admin settings table (key-value store)
-- Stores platform configuration like support email, notification preferences

create table admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create trigger admin_settings_updated_at
  before update on admin_settings
  for each row execute procedure update_updated_at();

-- RLS
alter table admin_settings enable row level security;

-- Anyone can read settings (needed for email sending from API routes)
create policy "Settings are readable by authenticated users"
  on admin_settings for select
  using (auth.uid() is not null);

-- Only admins can update settings
create policy "Admins can manage settings"
  on admin_settings for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Seed default settings
insert into admin_settings (key, value) values
  ('support_email', 'support@chemconnect.com.au'),
  ('support_phone', '+61 2 9876 5432'),
  ('site_name', 'Chem Connect'),
  ('currency', 'AUD'),
  ('tax_rate', '10'),
  ('min_order_value', '100'),
  ('email_notifications_enabled', 'true')
on conflict (key) do nothing;
