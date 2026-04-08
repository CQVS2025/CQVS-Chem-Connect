-- Migration 024: Xero OAuth credentials storage
-- Single-row table holding the active Xero connection (admin-level).

create table if not exists xero_credentials (
  id uuid not null default uuid_generate_v4() primary key,
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_by uuid references auth.users on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger xero_credentials_updated_at
  before update on xero_credentials
  for each row execute procedure update_updated_at();

-- Only one active connection at a time (we always read the most recent)
create index xero_credentials_updated_idx
  on xero_credentials (updated_at desc);

-- RLS: admin only
alter table xero_credentials enable row level security;

create policy "Admins can read xero credentials"
  on xero_credentials for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can manage xero credentials"
  on xero_credentials for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================
-- Xero sync log (for debugging and admin visibility)
-- ============================================
create table if not exists xero_sync_log (
  id uuid not null default uuid_generate_v4() primary key,
  entity_type text not null,
  entity_id text,
  action text not null,
  status text not null,
  xero_id text,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

create index xero_sync_log_created_idx on xero_sync_log (created_at desc);
create index xero_sync_log_entity_idx on xero_sync_log (entity_type, entity_id);

alter table xero_sync_log enable row level security;

create policy "Admins can read xero sync log"
  on xero_sync_log for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Service can insert xero sync log"
  on xero_sync_log for insert
  with check (true);
