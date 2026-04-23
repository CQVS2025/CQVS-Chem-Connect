-- ============================================
-- Marketing Module (GoHighLevel Integration)
-- ============================================
-- Adds the foundation for the marketing module that mirrors GoHighLevel
-- contacts, campaigns, SMS conversations, and event stream into Supabase
-- as a local cache + augmentation layer. GHL remains source of truth for
-- sends, scheduling, and sequence execution.
--
-- Tables:
--   ghl_oauth_tokens      -- reserved for future OAuth upgrade (currently unused)
--   marketing_contacts    -- local cache of GHL contacts
--   marketing_campaigns   -- campaigns launched from ChemConnect
--   marketing_events      -- append-only event stream from GHL webhooks
--   sms_conversations     -- SMS thread per contact
--   sms_messages          -- every inbound/outbound SMS
--   marketing_audit_log   -- actor/action trail for Spam Act compliance
--
-- This migration is written to be re-runnable: types, indexes, and policies
-- all guard against "already exists" errors so a failed first run can be
-- re-applied without manual cleanup.

-- ============================================
-- Extend profiles.role enum with marketing roles
-- ============================================
-- profiles.role is a Postgres enum (user_role). New values must exist before
-- we reference them in RLS policies. ALTER TYPE ADD VALUE IF NOT EXISTS is
-- safe to re-run.
alter type user_role add value if not exists 'marketing_admin';
alter type user_role add value if not exists 'marketing_editor';

-- ============================================
-- Enums (idempotent via DO block)
-- ============================================
do $$ begin
  create type marketing_contact_source as enum (
    'ghl_initial_sync',
    'ghl_webhook',
    'csv_import',
    'manual',
    'sms_auto_create'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type marketing_campaign_type as enum ('email', 'sms');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type marketing_campaign_status as enum (
    'draft',
    'scheduled',
    'sending',
    'sent',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type marketing_event_type as enum (
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'unsubscribed',
    'failed',
    'sms_delivered',
    'sms_failed',
    'sms_received'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sms_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sms_status as enum (
    'queued',
    'sent',
    'delivered',
    'failed',
    'received'
  );
exception when duplicate_object then null;
end $$;

-- ============================================
-- 1. GHL OAuth / Private Integration tokens
-- ============================================
-- Reserved for future use. Currently tokens live in env vars
-- (GHL_PRIVATE_INTEGRATION_TOKEN). When/if we upgrade to an OAuth
-- Marketplace app, tokens will be stored here.
-- TODO: encrypt at rest with pgp_sym_encrypt once actually used.
create table if not exists ghl_oauth_tokens (
  id uuid not null default uuid_generate_v4() primary key,
  location_id text not null unique,
  token text not null,                              -- plaintext for now; see TODO above
  token_type text not null default 'private_integration',  -- 'private_integration' | 'oauth'
  scopes text[] default array[]::text[],
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  last_verified_at timestamptz
);

alter table ghl_oauth_tokens enable row level security;

drop policy if exists "Admins can manage GHL tokens" on ghl_oauth_tokens;
create policy "Admins can manage GHL tokens"
  on ghl_oauth_tokens for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================
-- 2. Marketing contacts (local cache of GHL)
-- ============================================
create table if not exists marketing_contacts (
  id uuid not null default uuid_generate_v4() primary key,
  ghl_contact_id text unique,
  email text,
  phone text,
  first_name text,
  last_name text,
  full_name text,
  company_name text,
  state text,
  country text default 'AU',
  tags text[] default array[]::text[],
  custom_fields jsonb default '{}'::jsonb,
  is_opted_out boolean not null default false,
  opted_out_at timestamptz,
  opted_out_reason text,
  source marketing_contact_source not null default 'manual',
  profile_id uuid references profiles(id) on delete set null,
  last_synced_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_contacts_ghl_id_idx on marketing_contacts (ghl_contact_id);
create index if not exists marketing_contacts_email_idx on marketing_contacts (lower(email));
create index if not exists marketing_contacts_phone_idx on marketing_contacts (phone);
create index if not exists marketing_contacts_profile_idx on marketing_contacts (profile_id);
create index if not exists marketing_contacts_tags_idx on marketing_contacts using gin (tags);
create index if not exists marketing_contacts_not_deleted_idx
  on marketing_contacts (id) where deleted_at is null;

drop trigger if exists marketing_contacts_updated_at on marketing_contacts;
create trigger marketing_contacts_updated_at
  before update on marketing_contacts
  for each row execute procedure update_updated_at();

alter table marketing_contacts enable row level security;

drop policy if exists "Marketing team can manage contacts" on marketing_contacts;
create policy "Marketing team can manage contacts"
  on marketing_contacts for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  );

-- ============================================
-- 3. Marketing campaigns
-- ============================================
create table if not exists marketing_campaigns (
  id uuid not null default uuid_generate_v4() primary key,
  ghl_bulk_action_id text unique,
  name text not null,
  type marketing_campaign_type not null,
  status marketing_campaign_status not null default 'draft',
  audience_filter jsonb not null default '{}'::jsonb,
  audience_count integer not null default 0,
  subject text,
  preheader text,
  body_html text,
  body_text text,
  from_email text,
  from_name text,
  reply_to text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  recurring_rule jsonb,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  bounced_count integer not null default 0,
  unsubscribed_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_status_idx on marketing_campaigns (status);
create index if not exists marketing_campaigns_scheduled_idx on marketing_campaigns (scheduled_at);
create index if not exists marketing_campaigns_sent_idx on marketing_campaigns (sent_at desc);

drop trigger if exists marketing_campaigns_updated_at on marketing_campaigns;
create trigger marketing_campaigns_updated_at
  before update on marketing_campaigns
  for each row execute procedure update_updated_at();

alter table marketing_campaigns enable row level security;

drop policy if exists "Marketing team can manage campaigns" on marketing_campaigns;
create policy "Marketing team can manage campaigns"
  on marketing_campaigns for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  );

-- Marketing editors cannot DELETE campaigns (only admins can).
drop policy if exists "Only admins can delete campaigns" on marketing_campaigns;
create policy "Only admins can delete campaigns"
  on marketing_campaigns for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'marketing_admin')
    )
  );

-- ============================================
-- 4. Marketing events (append-only from GHL webhooks)
-- ============================================
create table if not exists marketing_events (
  id uuid not null default uuid_generate_v4() primary key,
  ghl_event_id text unique,
  event_type marketing_event_type not null,
  campaign_id uuid references marketing_campaigns(id) on delete set null,
  contact_id uuid references marketing_contacts(id) on delete set null,
  ghl_contact_id text,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now()
);

create index if not exists marketing_events_campaign_type_idx on marketing_events (campaign_id, event_type);
create index if not exists marketing_events_contact_idx on marketing_events (contact_id, occurred_at desc);
create index if not exists marketing_events_occurred_idx on marketing_events (occurred_at desc);

alter table marketing_events enable row level security;

drop policy if exists "Marketing team can read events" on marketing_events;
create policy "Marketing team can read events"
  on marketing_events for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  );

-- Inserts happen via service_role only (webhook ingestion) — no authenticated insert policy.

-- ============================================
-- 5. SMS conversations
-- ============================================
create table if not exists sms_conversations (
  id uuid not null default uuid_generate_v4() primary key,
  ghl_conversation_id text unique,
  contact_id uuid references marketing_contacts(id) on delete cascade not null,
  unread_count integer not null default 0,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_direction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_conversations_contact_idx on sms_conversations (contact_id);
create index if not exists sms_conversations_last_message_idx on sms_conversations (last_message_at desc);
create index if not exists sms_conversations_unread_idx
  on sms_conversations (unread_count) where unread_count > 0;

drop trigger if exists sms_conversations_updated_at on sms_conversations;
create trigger sms_conversations_updated_at
  before update on sms_conversations
  for each row execute procedure update_updated_at();

alter table sms_conversations enable row level security;

drop policy if exists "Marketing team can manage conversations" on sms_conversations;
create policy "Marketing team can manage conversations"
  on sms_conversations for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  );

-- ============================================
-- 6. SMS messages
-- ============================================
create table if not exists sms_messages (
  id uuid not null default uuid_generate_v4() primary key,
  ghl_message_id text unique,
  conversation_id uuid references sms_conversations(id) on delete cascade not null,
  direction sms_direction not null,
  body text not null,
  from_number text,
  to_number text,
  status sms_status not null default 'queued',
  sent_by uuid references profiles(id) on delete set null,
  error_message text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_conversation_idx on sms_messages (conversation_id, occurred_at desc);
create index if not exists sms_messages_ghl_id_idx on sms_messages (ghl_message_id);

alter table sms_messages enable row level security;

drop policy if exists "Marketing team can manage messages" on sms_messages;
create policy "Marketing team can manage messages"
  on sms_messages for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  );

-- ============================================
-- 7. Marketing audit log (Spam Act compliance)
-- ============================================
create table if not exists marketing_audit_log (
  id uuid not null default uuid_generate_v4() primary key,
  actor_profile_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists marketing_audit_action_idx on marketing_audit_log (action, occurred_at desc);
create index if not exists marketing_audit_actor_idx on marketing_audit_log (actor_profile_id, occurred_at desc);
create index if not exists marketing_audit_target_idx on marketing_audit_log (target_type, target_id);

alter table marketing_audit_log enable row level security;

drop policy if exists "Marketing team can read audit log" on marketing_audit_log;
create policy "Marketing team can read audit log"
  on marketing_audit_log for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'marketing_admin', 'marketing_editor')
    )
  );

-- ============================================
-- 8. Seed marketing sender identity into admin_settings
-- ============================================
insert into admin_settings (key, value) values
  ('marketing.from_email', 'jonny@cqvs.com.au'),
  ('marketing.from_name', 'Jonny Harper'),
  ('marketing.reply_to', 'jonny@cqvs.com.au'),
  ('marketing.business_address', '7/17 Rothcote Court, Burleigh Heads QLD, Australia'),
  ('marketing.business_name', 'CQVS'),
  ('marketing.sending_domain', 'send.cqvs-chemconnect.com.au'),
  ('marketing.ghl_location_id', 'FQ5OnSrbC8BdZbTnWvp8'),
  ('marketing.enabled', 'true'),
  ('marketing.sms_enabled', 'false'),
  ('marketing.sms_from_number', '')
on conflict (key) do nothing;
