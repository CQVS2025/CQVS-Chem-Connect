-- Migration 050: Unified integration log for Xero + MacShip outbound API calls.
--
-- Replaces ad-hoc console logging and the older xero_sync_log table by
-- capturing every API call to a third-party integration with full request,
-- response, status, and customer-journey context.
--
-- Designed so that when a customer reports "my checkout broke" or "my
-- invoice didn't arrive", an admin can paste their user_id (or order
-- number, or correlation_id) into /admin/integration-logs and see the
-- entire call chain across both integrations in one place.

create table if not exists integration_log (
  id uuid not null default uuid_generate_v4() primary key,

  -- Which third-party platform this row is for.
  -- Constrained so reports/filters are stable.
  integration text not null check (integration in ('xero', 'macship')),

  -- The API endpoint hit. Path-only, query string stripped.
  -- e.g. "/apiv2/routes/returnroutes", "/Contacts", "/PurchaseOrders/{id}/Email"
  endpoint text not null,
  method text not null,

  -- HTTP outcome.
  -- http_status = 0 indicates a network-level failure where no response was
  -- received (DNS, connection reset, TLS, fetch failed, etc.).
  http_status integer not null default 0,
  duration_ms integer,

  -- Coarse status for cheap dashboard filters.
  -- 'warning' is for soft failures we can recover from (e.g. PO created
  -- but email-to-warehouse failed; we don't want to mark the whole flow as
  -- error but we do want it visible).
  status text not null check (status in ('success', 'error', 'warning')),

  -- Bucketed cause so admins can triage without reading every payload.
  -- - auth:           token expired/missing/refresh-failed/AuthenticationUnsuccessful
  -- - rate_limit:     429 from either provider
  -- - validation:     400 with ValidationErrors / Machship validation
  -- - business:       provider says no (no prices/no routes/contact name dup,
  --                   PO email needs contact email, DG mismatch, etc.)
  -- - carrier_config: account-level Machship issue (no carriers configured)
  --                   - this is the urgent bucket the prod incident hit
  -- - network:        we couldn't reach the provider (DNS, fetch failed)
  -- - server:         provider 5xx
  -- - unknown:        anything else
  error_category text check (error_category in (
    'auth',
    'rate_limit',
    'validation',
    'business',
    'carrier_config',
    'network',
    'server',
    'unknown'
  )),

  -- Stable, machine-friendly error code parsed from the provider's body.
  -- Examples: NO_ROUTES, NO_PRICES, DG_NOT_SUPPORTED, CONTACT_NAME_DUP,
  -- PO_CONTACT_NO_EMAIL, AUTH_UNSUCCESSFUL, NET_DNS, NET_FETCH_FAILED.
  error_code text,

  -- Full human-readable error message (whatever the provider returned plus
  -- our own hint when applicable).
  error_message text,

  -- Customer-journey linking.
  -- All nullable: a token-refresh sweep cron has none of these; a quote
  -- request from an anonymous shopper has only correlation_id; a finalize
  -- has all three.
  correlation_id uuid,
  user_id uuid references auth.users on delete set null,
  order_id uuid references orders on delete set null,

  -- Carry-overs from the legacy xero_sync_log shape so existing UIs and
  -- queries keep working when we point them here.
  entity_type text,
  entity_id text,
  xero_id text,
  action text,

  -- Payloads. Both are jsonb so we can search/filter without reparsing.
  -- request_payload has tokens, secrets, and PII redacted before insert
  -- (see lib/integration-log/redact.ts).
  request_payload jsonb,
  response_payload jsonb,

  -- Only the headers we actually want to keep:
  --   xero:    X-AppMinLimit-Remaining, X-DayLimit-Remaining, Retry-After
  --   macship: rate-limit headers if present
  -- Auth headers are NOT stored.
  response_headers jsonb,

  -- Free-form contextual hints set by the call site:
  --   { postcode, state, items_count, weight_kg, carrier_id, dg, ... }
  -- This is the metadata that makes "why did this customer's quote fail"
  -- answerable in seconds.
  metadata jsonb,

  created_at timestamptz not null default now()
);

-- Time-ordered listing (admin page default sort)
create index integration_log_created_idx
  on integration_log (created_at desc);

-- Per-integration listing (existing /admin/xero and /admin/macship Activity)
create index integration_log_integration_created_idx
  on integration_log (integration, created_at desc);

-- "Show me only failures" filter
create index integration_log_status_idx
  on integration_log (status, created_at desc)
  where status <> 'success';

-- Customer-journey lookup: paste a correlation_id, get the trail.
create index integration_log_correlation_idx
  on integration_log (correlation_id)
  where correlation_id is not null;

-- "What happened with order ORD-NNN" lookup
create index integration_log_order_idx
  on integration_log (order_id, created_at desc)
  where order_id is not null;

-- "Show this user's history" lookup
create index integration_log_user_idx
  on integration_log (user_id, created_at desc)
  where user_id is not null;

-- Triage-by-cause filter for admin dashboard
create index integration_log_error_category_idx
  on integration_log (error_category, created_at desc)
  where error_category is not null;

-- Backwards-compat indexes for code that still queries by entity
create index integration_log_entity_idx
  on integration_log (entity_type, entity_id);

alter table integration_log enable row level security;

create policy "Admins can read integration log"
  on integration_log for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Service role only — clients must never insert into this table directly.
create policy "Service can insert integration log"
  on integration_log for insert
  with check (true);
