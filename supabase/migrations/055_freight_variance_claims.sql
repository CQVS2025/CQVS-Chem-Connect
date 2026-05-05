-- Migration 055: freight variance claims (contract-driven variance handling).
--
-- The default contract: supplier eats freight variance unless they raised
-- a pre-dispatch claim within the agreed notification window. This table
-- captures the supplier's claim + admin's review decision. Approved claims
-- override the locked-at-quote orders.shipping when the dispatch endpoint
-- writes supplier_freight_cost.
--
-- Lifecycle:
--   1. Supplier opens claim BEFORE dispatching (status='pending').
--   2. Admin reviews via /admin/supplier-fulfillment/variance-claims.
--   3. Admin approves (with claimed_amount) or rejects.
--   4. Approved row is consulted on in_transit transition; supplier_freight_cost
--      is set to claimed_amount instead of orders.shipping.

create table if not exists freight_variance_claims (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  warehouse_id          uuid not null references warehouses(id) on delete restrict,
  claimed_by            uuid not null references auth.users(id) on delete restrict,
  claimed_amount        numeric(10,2) not null,
  notification_evidence text,
  notified_at           timestamptz,
  status                text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  reviewed_by           uuid references auth.users(id),
  reviewed_at           timestamptz,
  decision_note         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists freight_variance_claims_order_idx
  on freight_variance_claims (order_id, status);
create index if not exists freight_variance_claims_warehouse_idx
  on freight_variance_claims (warehouse_id, created_at desc);
create index if not exists freight_variance_claims_status_idx
  on freight_variance_claims (status, created_at desc);

create or replace function freight_variance_claims_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_freight_variance_claims_updated_at
  on freight_variance_claims;
create trigger trg_freight_variance_claims_updated_at
  before update on freight_variance_claims
  for each row execute function freight_variance_claims_touch_updated_at();

alter table freight_variance_claims enable row level security;

-- Admins manage everything.
create policy "Admins manage freight variance claims"
  on freight_variance_claims for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Suppliers can read their own warehouses' claims.
create policy "Suppliers read own variance claims"
  on freight_variance_claims for select
  using (
    exists (
      select 1 from warehouse_users wu
      where wu.warehouse_id = freight_variance_claims.warehouse_id
        and wu.user_id = auth.uid()
    )
  );

-- Suppliers can insert claims for their own warehouses (with update permission).
create policy "Suppliers insert own variance claims"
  on freight_variance_claims for insert
  with check (
    claimed_by = auth.uid()
    and exists (
      select 1 from warehouse_users wu
      where wu.warehouse_id = freight_variance_claims.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

-- Suppliers can update their own pending claims (e.g. add evidence)
-- before admin reviews. Once status leaves 'pending' it's admin-only.
create policy "Suppliers update own pending claims"
  on freight_variance_claims for update
  using (
    status = 'pending'
    and claimed_by = auth.uid()
    and exists (
      select 1 from warehouse_users wu
      where wu.warehouse_id = freight_variance_claims.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  )
  with check (
    status = 'pending'
    and claimed_by = auth.uid()
  );
