-- =============================================================================
-- Migration 051: Supplier-Managed Fulfillment (Feature B, Phase 1a)
-- =============================================================================
--
-- Adds the second fulfillment path: a warehouse can be flagged as
-- "supplier-managed", in which case freight is quoted from the supplier's
-- distance-bracketed rate sheet rather than via MacShip. The supplier
-- gets a scoped dashboard, the buyer sees dispatch + ETA + tracking,
-- and admin gets reconciliation, SLA flagging, and variance checks.
--
-- All changes are additive and gated by warehouses.is_supplier_managed
-- (default false). Existing rows, the MacShip integration, and the
-- existing Stripe wiring are unaffected.
--
-- Sources: docs/Reviews-and-Supplier-Fulfillment-Implementation-Plan.html
--          docs/Supplier-Managed-Fulfillment-Requirements.html
--          docs/Supplier-Managed-Fulfillment-Response.html

-- ============================================
-- M1. Flag warehouses as supplier-managed
-- ============================================
alter table warehouses
  add column if not exists is_supplier_managed boolean not null default false;

create index if not exists warehouses_is_supplier_managed_idx
  on warehouses (is_supplier_managed)
  where is_supplier_managed = true;

-- ============================================
-- M2. Freight engine: rate sheets + brackets
-- ============================================
create table if not exists supplier_rate_sheets (
  id uuid not null default uuid_generate_v4() primary key,
  warehouse_id uuid not null references warehouses on delete cascade,
  name text not null,
  -- Five unit types cover all locked B2B freight models. Anything that
  -- doesn't fit one of these is a Phase 2 design conversation, not a
  -- silent extension.
  unit_type text not null check (unit_type in (
    'per_litre','flat_per_consignment','per_kg','per_pallet','per_zone'
  )),
  origin_postcode text,                                 -- defaults to warehouses.address_postcode if null
  is_active boolean not null default true,
  -- Min freight charge (3.11): a small drop near the depot may otherwise
  -- price below cost.
  min_charge numeric(10, 2),
  -- 4001+ km behaviour (3.11): block, fall back to the last bracket, or
  -- show "quote on application".
  out_of_range_behavior text not null default 'last_bracket'
    check (out_of_range_behavior in ('last_bracket', 'block', 'quote_on_application')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, name)
);

create trigger supplier_rate_sheets_updated_at
  before update on supplier_rate_sheets
  for each row execute procedure update_updated_at();

create index if not exists supplier_rate_sheets_warehouse_idx
  on supplier_rate_sheets (warehouse_id);
create index if not exists supplier_rate_sheets_active_idx
  on supplier_rate_sheets (warehouse_id, is_active)
  where is_active = true;

create table if not exists supplier_rate_sheet_brackets (
  id uuid not null default uuid_generate_v4() primary key,
  rate_sheet_id uuid not null references supplier_rate_sheets on delete cascade,
  distance_from_km integer not null check (distance_from_km >= 0),
  distance_to_km integer not null,
  rate numeric(10, 4) not null check (rate >= 0),
  created_at timestamptz not null default now(),
  check (distance_to_km > distance_from_km),
  unique (rate_sheet_id, distance_from_km, distance_to_km)
);

create index if not exists supplier_rate_sheet_brackets_lookup_idx
  on supplier_rate_sheet_brackets (rate_sheet_id, distance_to_km);

-- ============================================
-- M3. Map product+packaging to rate sheet
-- ============================================
create table if not exists product_freight_rate_sheets (
  product_id uuid not null references products on delete cascade,
  packaging_size_id uuid references packaging_sizes on delete cascade,
  rate_sheet_id uuid not null references supplier_rate_sheets on delete cascade,
  created_at timestamptz not null default now()
);

-- packaging_size_id NULL = "applies to all sizes for this product".
-- Two partial indexes mirror the pattern used for product_warehouses (029)
-- so NULL handling is consistent across the codebase.
create unique index if not exists product_freight_rate_sheets_with_size_idx
  on product_freight_rate_sheets (product_id, packaging_size_id)
  where packaging_size_id is not null;

create unique index if not exists product_freight_rate_sheets_null_size_idx
  on product_freight_rate_sheets (product_id)
  where packaging_size_id is null;

create index if not exists product_freight_rate_sheets_sheet_idx
  on product_freight_rate_sheets (rate_sheet_id);

-- ============================================
-- M4. Configurable site-access questions
-- ============================================
create table if not exists product_checkout_questions (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  packaging_size_id uuid references packaging_sizes on delete cascade,
  question_key text not null,                           -- machine key, e.g. 'truck_access_19m'
  label text not null,                                  -- shown to the buyer
  help_text text,
  question_type text not null check (question_type in (
    'yes_no','text','number','select'
  )),
  options jsonb,                                        -- for type='select': [{value,label}, ...]
  required boolean not null default false,
  -- When the answer is the literal string in `warning_when_value`, checkout
  -- shows `warning_copy` but lets the order through (component 7).
  warning_when_value text,
  warning_copy text,
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger product_checkout_questions_updated_at
  before update on product_checkout_questions
  for each row execute procedure update_updated_at();

-- Mirror the partial-index NULL pattern (029) for the (product, size, key) uniqueness.
create unique index if not exists product_checkout_questions_with_size_idx
  on product_checkout_questions (product_id, packaging_size_id, question_key)
  where packaging_size_id is not null;

create unique index if not exists product_checkout_questions_null_size_idx
  on product_checkout_questions (product_id, question_key)
  where packaging_size_id is null;

create index if not exists product_checkout_questions_product_idx
  on product_checkout_questions (product_id, is_active)
  where is_active = true;

-- ============================================
-- M5. New columns on orders for supplier-managed flow
-- ============================================
alter table orders
  add column if not exists supplier_dispatch_date date,
  add column if not exists supplier_dispatch_notes text,
  add column if not exists supplier_tracking_url text,
  add column if not exists supplier_freight_cost numeric(10, 2),
  add column if not exists site_access_answers jsonb,
  -- Q2 / 3.10: supplier picks the actual depot postcode after the order
  -- arrives. Distinct from rate_sheet origin so we can recalc freight
  -- accurately at dispatch (variance check, component 16).
  add column if not exists supplier_origin_postcode text,
  -- Variance check (component 16): true if recalculated freight at dispatch
  -- differs from the indicative quote by more than the configured threshold.
  add column if not exists supplier_variance_flagged boolean not null default false,
  add column if not exists supplier_variance_amount numeric(10, 2),
  -- SLA stuck-order flag (component 14): admin-only computed convenience.
  add column if not exists supplier_sla_breached boolean not null default false;

-- Index for the SLA refresh sweep (component 14)
create index if not exists orders_supplier_sla_idx
  on orders (warehouse_id, created_at)
  where estimated_delivery is null and supplier_sla_breached = false;

-- ============================================
-- M5b. Multi-user supplier model
-- ============================================
create table if not exists warehouse_users (
  id uuid not null default uuid_generate_v4() primary key,
  warehouse_id uuid not null references warehouses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  receives_po_emails boolean not null default true,
  can_update_orders boolean not null default true,
  is_primary_contact boolean not null default false,
  created_at timestamptz not null default now(),
  unique (warehouse_id, user_id)
);

create index if not exists warehouse_users_user_idx on warehouse_users (user_id);
create index if not exists warehouse_users_warehouse_idx on warehouse_users (warehouse_id);

-- New role for the supplier dashboard scope.
-- (commit-then-use rule for enum values — no other DDL or DML referencing
-- 'supplier' may run in this transaction. We split the enum extension and
-- the seed/policies into two transactions.)
alter type user_role add value if not exists 'supplier';

-- ============================================
-- M5c. Audit log of supplier dispatch changes
--   Plan §3.10: "Every change to dispatch_date / ETA / status records
--   actor + timestamp." Distinct from the existing order_status_history
--   trigger so we capture non-status field changes too.
-- ============================================
create table if not exists order_supplier_audit_log (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  actor_id uuid references auth.users,
  field text not null check (field in (
    'supplier_dispatch_date',
    'estimated_delivery',
    'supplier_dispatch_notes',
    'supplier_tracking_url',
    'supplier_origin_postcode',
    'status',
    'supplier_freight_cost',
    'supplier_variance'
  )),
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists order_supplier_audit_log_order_idx
  on order_supplier_audit_log (order_id, created_at desc);

-- ============================================
-- M10. Per-packaging-size storefront visibility
-- ============================================
alter table packaging_sizes
  add column if not exists is_visible_on_storefront boolean not null default true;

-- ============================================
-- M11. Mixed-cart block events (counter for Phase 2 sizing)
-- ============================================
create table if not exists mixed_cart_block_events (
  id uuid not null default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  macship_product_id uuid references products on delete set null,
  supplier_product_id uuid references products on delete set null,
  macship_product_name text,
  supplier_product_name text,
  created_at timestamptz not null default now()
);

create index if not exists mixed_cart_block_events_created_at_idx
  on mixed_cart_block_events (created_at desc);

-- ============================================
-- Buyer-notification dedupe state (component 13)
-- ============================================
create table if not exists order_supplier_notification_state (
  order_id uuid primary key references orders on delete cascade,
  last_dispatch_date_emailed date,
  last_eta_emailed date,
  last_emailed_at timestamptz
);

-- ============================================
-- Variance threshold + SLA threshold settings
--   Defaults locked per the plan:
--     - 10% or $100 (whichever greater) for variance (component 16)
--     - 24h for SLA stuck-order flag (component 14)
-- ============================================
insert into admin_settings (key, value)
values
  ('supplier_variance_pct',     '10'),
  ('supplier_variance_floor',   '100'),
  ('supplier_sla_hours',        '24')
on conflict (key) do nothing;

-- ============================================
-- Row Level Security
--   - Public can read active rate sheets / brackets / mappings / questions
--     (the storefront and checkout need them on session-scoped clients).
--   - Admins (profiles.role = 'admin') manage everything.
--   - Suppliers (profiles.role = 'supplier' AND a warehouse_users row)
--     can read orders + order_items for their warehouses, and update the
--     supplier-only columns on those orders.
-- ============================================
alter table supplier_rate_sheets             enable row level security;
alter table supplier_rate_sheet_brackets     enable row level security;
alter table product_freight_rate_sheets      enable row level security;
alter table product_checkout_questions       enable row level security;
alter table warehouse_users                  enable row level security;
alter table mixed_cart_block_events          enable row level security;
alter table order_supplier_notification_state enable row level security;
alter table order_supplier_audit_log         enable row level security;

-- ---- public reads (storefront + checkout) ------------------------------
create policy "Anyone reads active rate sheets"
  on supplier_rate_sheets for select using (is_active = true);

create policy "Anyone reads brackets of active sheets"
  on supplier_rate_sheet_brackets for select using (
    exists (
      select 1 from supplier_rate_sheets s
      where s.id = supplier_rate_sheet_brackets.rate_sheet_id and s.is_active = true
    )
  );

create policy "Anyone reads product freight maps"
  on product_freight_rate_sheets for select using (true);

create policy "Anyone reads active checkout questions"
  on product_checkout_questions for select using (is_active = true);

-- ---- admin manages everything ------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'supplier_rate_sheets',
    'supplier_rate_sheet_brackets',
    'product_freight_rate_sheets',
    'product_checkout_questions',
    'warehouse_users',
    'mixed_cart_block_events',
    'order_supplier_notification_state',
    'order_supplier_audit_log'
  ]) loop
    execute format($f$
      create policy "Admins manage %1$s"
        on %1$s for all
        using (
          exists (select 1 from profiles where id = auth.uid() and role = 'admin')
        )
        with check (
          exists (select 1 from profiles where id = auth.uid() and role = 'admin')
        )
    $f$, t);
  end loop;
end$$;

-- ---- supplier reads their warehouse_users row + their warehouses' rate sheets
create policy "Suppliers read own membership"
  on warehouse_users for select
  using (user_id = auth.uid());

create policy "Suppliers read own audit log"
  on order_supplier_audit_log for select
  using (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_supplier_audit_log.order_id
        and wu.user_id = auth.uid()
    )
  );

-- ---- supplier reads orders + order_items + warehouses for their assigned warehouses
-- Adds new policies that coexist with the existing buyer/admin policies.
create policy "Suppliers read assigned warehouse orders"
  on orders for select
  using (
    exists (
      select 1 from warehouse_users wu
      where wu.warehouse_id = orders.warehouse_id
        and wu.user_id = auth.uid()
    )
  );

create policy "Suppliers update assigned warehouse orders"
  on orders for update
  using (
    exists (
      select 1 from warehouse_users wu
      where wu.warehouse_id = orders.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers read assigned warehouse order items"
  on order_items for select
  using (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_items.order_id
        and wu.user_id = auth.uid()
    )
  );

create policy "Suppliers read warehouses they belong to"
  on warehouses for select
  using (
    exists (
      select 1 from warehouse_users wu
      where wu.warehouse_id = warehouses.id and wu.user_id = auth.uid()
    )
  );

-- ============================================
-- Convenience view for the reconciliation report (component 15).
--   Joins orders → warehouse_product_pricing for full margin in one read.
--   The API (/api/admin/supplier-fulfillment/reconciliation) can use this
--   or compute on the fly; the view makes ad-hoc Xero queries trivial.
-- ============================================
create or replace view supplier_order_reconciliation as
select
  o.id,
  o.order_number,
  o.created_at,
  o.warehouse_id,
  w.name                          as warehouse_name,
  o.subtotal,
  o.shipping                      as buyer_shipping,
  coalesce(o.supplier_freight_cost, 0)::numeric(10,2) as supplier_freight_cost,
  coalesce(
    (select sum(coalesce(wpp.cost_price, 0) * oi.quantity)
       from order_items oi
       left join warehouse_product_pricing wpp
         on wpp.warehouse_id = o.warehouse_id
        and wpp.product_id = oi.product_id
        and wpp.packaging_size_id = oi.packaging_size_id
      where oi.order_id = o.id),
    0
  )::numeric(10,2)                as product_cost,
  (o.shipping - coalesce(o.supplier_freight_cost, 0))::numeric(10,2)
                                   as freight_margin
from orders o
join warehouses w on w.id = o.warehouse_id
where w.is_supplier_managed = true;

-- ============================================
-- Phase 1 seed data (idempotent — safe to re-run)
--   - One AdBlue Bulk rate sheet stub on the first supplier-managed
--     warehouse (admin uploads brackets via the UI).
--   - The seven locked AdBlue Bulk site-access questions.
--   - Hide the non-Bulk AdBlue packaging sizes from the storefront
--     (component 18; flipped back on in Phase 2).
--
-- This block does nothing if there is no AdBlue product or no
-- supplier-managed warehouse yet — the admin onboards both first, then
-- this migration's idempotency means re-running it (or just running the
-- seed-only block in admin) wires the rest.
-- ============================================
do $$
declare
  v_adblue uuid;
  v_supplier_wh uuid;
  v_rate_sheet_id uuid;
begin
  select id into v_adblue from products where slug = 'adblue-def' limit 1;
  select id into v_supplier_wh from warehouses where is_supplier_managed = true order by sort_order limit 1;

  if v_adblue is null then
    raise notice '[051 seed] AdBlue product not found - skipping seed.';
    return;
  end if;

  -- Hide non-Bulk AdBlue packaging sizes for Phase 1 (component 18).
  -- "Bulk" is intentionally not in this list: any "Bulk *" packaging size
  -- the admin creates will keep is_visible_on_storefront = true.
  update packaging_sizes
     set is_visible_on_storefront = false
   where name in ('10L Jerry Can', '200L Drum', '1000L IBC')
     and is_visible_on_storefront = true
     and exists (
       select 1 from product_packaging_prices ppp
       where ppp.product_id = v_adblue and ppp.packaging_size_id = packaging_sizes.id
     );

  -- Seed checkout questions for AdBlue (Bulk only — packaging_size_id NULL
  -- means "all sizes"; in Phase 1 only Bulk is visible, so this works).
  insert into product_checkout_questions
    (product_id, packaging_size_id, question_key, label, help_text,
     question_type, options, required, warning_when_value, warning_copy, display_order)
  values
    (v_adblue, null, 'truck_access_19m',
     'Can a 19-metre rigid/tanker truck access the delivery site?', null,
     'yes_no', null, true, 'no',
     'Our standard delivery is a 19-metre tanker. If this truck cannot access your site, the supplier will contact you to arrange an alternative, which may involve additional cost or delay.', 10),
    (v_adblue, null, 'tank_capacity_litres',
     'Tank capacity (litres) and approximate empty space at delivery',
     'So the supplier doesn''t arrive with more product than fits.',
     'number', null, true, null, null, 20),
    (v_adblue, null, 'fill_point_location',
     'Fill point location and approximate hose run distance from where the truck can park', null,
     'text', null, true, null, null, 30),
    (v_adblue, null, 'site_hours',
     'Site operating hours and after-hours contact number', null,
     'text', null, true, null, null, 40),
    (v_adblue, null, 'site_induction',
     'Does this site require induction or sign-in?', 'Free-text notes can go in delivery notes.',
     'yes_no', null, false, null, null, 50),
    (v_adblue, null, 'hardstand',
     'Hardstand suitable for a loaded tanker?',
     'Some yards are too soft for a loaded tanker.',
     'yes_no', null, true, 'no',
     'Loaded tankers can sink into soft yards. Please contact us if hardstand is unavailable.', 60),
    (v_adblue, null, 'tank_fitting_type',
     'Existing tank fitting type',
     'Camlock size, dry-break, etc. The supplier confirms compatible options.',
     'select',
     '[{"value":"camlock_2","label":"2\" Camlock"},{"value":"camlock_3","label":"3\" Camlock"},{"value":"dry_break","label":"Dry-break"},{"value":"other","label":"Other"}]'::jsonb,
     true, null, null, 70)
  on conflict do nothing;

  -- Seed an empty rate sheet so admin has something to upload brackets
  -- into. The product↔rate-sheet mapping and the product↔warehouse
  -- mapping (product_warehouses) are NOT seeded — admin makes those
  -- choices in the UI so the same flow works for any future supplier.
  if v_supplier_wh is not null then
    insert into supplier_rate_sheets
      (warehouse_id, name, unit_type, origin_postcode, is_active,
       out_of_range_behavior)
    values
      (v_supplier_wh, 'AdBlue Bulk Post-14Jul25', 'per_litre', null, true,
       'last_bracket')
    on conflict (warehouse_id, name) do nothing
    returning id into v_rate_sheet_id;
  end if;

  -- v_rate_sheet_id intentionally unused here — kept for symmetry with
  -- prior migrations that may have referenced it. Remove if linter
  -- complains.
  perform v_rate_sheet_id;
end$$;
