-- ============================================
-- GHL Marketplace App OAuth token storage
-- ============================================
-- Holds the access/refresh tokens returned after a sub-account installs
-- our Marketplace App. Not required for LCEmailStats webhook delivery
-- (GHL pushes those automatically once installed), but kept for future
-- use if we need to call GHL APIs under the OAuth context.
--
-- RLS: service-role only — these are secrets.
--
-- Supersedes the `ghl_oauth_tokens` placeholder defined in migration 032
-- (single-column `token` / `rotated_at` shape, never populated). The drop
-- is safe because the prior table had zero runtime writers — 032 even
-- marks it "Reserved for future use. Currently unused." Confirmed by grep.

drop table if exists public.ghl_oauth_tokens cascade;

create table public.ghl_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  -- One of location_id / company_id is populated depending on the install
  -- scope: Location installs give us a locationId, Company installs give us
  -- only companyId. The (location_id, company_id) pair is unique together.
  location_id text,
  company_id text,
  access_token text not null,
  refresh_token text not null,
  token_type text,
  scope text,
  user_type text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique install identity: same (location, company) pair overwrites tokens.
create unique index if not exists uq_ghl_oauth_tokens_install
  on public.ghl_oauth_tokens (
    coalesce(location_id, ''),
    coalesce(company_id, '')
  );

create index if not exists idx_ghl_oauth_tokens_location on public.ghl_oauth_tokens(location_id);
create index if not exists idx_ghl_oauth_tokens_company on public.ghl_oauth_tokens(company_id);

alter table public.ghl_oauth_tokens enable row level security;

-- Also accelerate the new LCEmailStats attribution lookups on the
-- marketing_events anchor metadata.
create index if not exists idx_marketing_events_email_message_id
  on public.marketing_events ((metadata->>'email_message_id'))
  where metadata->>'attribution_anchor' = 'true';

create index if not exists idx_marketing_events_recipient_email
  on public.marketing_events ((metadata->>'recipient_email'))
  where metadata->>'attribution_anchor' = 'true';
