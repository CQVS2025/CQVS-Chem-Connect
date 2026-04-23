-- ============================================
-- checkout_sessions
-- ============================================
-- Holds the in-flight checkout payload while Stripe is processing a card
-- payment. Card orders no longer appear in `orders` until Stripe confirms
-- the PaymentIntent - finalization reads the saved payload here, re-runs
-- the server-side calculation, then inserts into `orders` and fires all
-- downstream side effects (MacShip consignment, Xero PO, emails, etc).
--
-- Motivation: previously we inserted into `orders` up-front and relied on
-- the webhook to flip payment_status. But MacShip/Xero/admin notifications
-- had already fired, so a declined card left orphaned consignments and
-- junk rows in the admin order list. Confirmed with Jonny (Apr 2026).
--
-- Lifecycle:
--   1. POST /api/orders (stripe path) inserts a row here.
--   2. POST /api/orders/finalize OR the payment_intent.succeeded webhook
--      reads the row, creates the real order, and deletes the row.
--   3. Anything older than `expires_at` (default 30 min out) is garbage -
--      Stripe either already settled it or the customer abandoned checkout.
--      A scheduled cleanup can prune these; for now the row just sits.
--
-- RLS: owners can read/delete their own rows (for client-side finalize).
-- Service-role full access (for the webhook handler).

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_intent_id text not null unique,
  payload jsonb not null,
  amount_total numeric(12, 2) not null,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);

create index idx_checkout_sessions_user on public.checkout_sessions(user_id);
create index idx_checkout_sessions_expires on public.checkout_sessions(expires_at);

alter table public.checkout_sessions enable row level security;

-- Owner can see their own in-flight session (used by the finalize endpoint
-- which runs with the user's anon client).
create policy "checkout_sessions_owner_select"
  on public.checkout_sessions
  for select
  using (auth.uid() = user_id);

-- Owner can delete their own abandoned session (e.g. after navigating away).
create policy "checkout_sessions_owner_delete"
  on public.checkout_sessions
  for delete
  using (auth.uid() = user_id);

-- Inserts happen from the server via service role; no owner-insert policy
-- is needed. Updates are never performed (sessions are immutable once
-- created; they're deleted after finalize).
