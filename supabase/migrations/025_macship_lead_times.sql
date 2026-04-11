-- Migration 025: MacShip integration columns and lead time configuration tables

-- ============================================
-- 1. Add MacShip columns to orders
-- ============================================
alter table orders add column if not exists macship_consignment_id text;
alter table orders add column if not exists macship_carrier_id text;
alter table orders add column if not exists macship_tracking_url text;
alter table orders add column if not exists macship_pickup_date date;
alter table orders add column if not exists macship_manifest_id text;
alter table orders add column if not exists macship_dispatched_at timestamptz;
alter table orders add column if not exists macship_quote_amount numeric(10, 2);
alter table orders add column if not exists macship_governing_product_id uuid references products;
alter table orders add column if not exists macship_consignment_failed boolean not null default false;
alter table orders add column if not exists macship_lead_time_fallback boolean not null default false;

-- ============================================
-- 2. Global lead time defaults (single row)
-- ============================================
create table if not exists lead_time_global (
  id uuid not null default uuid_generate_v4() primary key,
  manufacturing_days integer not null default 5,
  buffer_days integer not null default 0,
  use_business_days boolean not null default true,
  updated_at timestamptz not null default now(),
  -- Enforce single row
  constraint lead_time_global_single_row check (true)
);

create trigger lead_time_global_updated_at
  before update on lead_time_global
  for each row execute procedure update_updated_at();

-- Seed one default row
insert into lead_time_global (manufacturing_days, buffer_days, use_business_days)
values (5, 0, true)
on conflict do nothing;

-- ============================================
-- 3. Warehouse-level lead time defaults
-- ============================================
create table if not exists lead_time_warehouse (
  id uuid not null default uuid_generate_v4() primary key,
  warehouse_id uuid not null references warehouses on delete cascade,
  manufacturing_days integer not null default 5,
  buffer_days integer not null default 0,
  use_business_days boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id)
);

create trigger lead_time_warehouse_updated_at
  before update on lead_time_warehouse
  for each row execute procedure update_updated_at();

-- ============================================
-- 4. Product + warehouse lead time overrides
-- ============================================
create table if not exists lead_time_product_warehouse (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  warehouse_id uuid not null references warehouses on delete cascade,
  manufacturing_days integer not null default 5,
  buffer_days integer not null default 0,
  use_business_days boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

create trigger lead_time_product_warehouse_updated_at
  before update on lead_time_product_warehouse
  for each row execute procedure update_updated_at();

create index lead_time_product_warehouse_product_idx
  on lead_time_product_warehouse (product_id);
create index lead_time_product_warehouse_warehouse_idx
  on lead_time_product_warehouse (warehouse_id);

-- ============================================
-- 5. MacShip failed consignment log
-- ============================================
create table if not exists macship_failed_updates (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  reason text not null,
  attempted_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz
);

create index macship_failed_updates_order_idx on macship_failed_updates (order_id);
create index macship_failed_updates_resolved_idx on macship_failed_updates (resolved);

-- ============================================
-- 6. RLS Policies
-- ============================================
alter table lead_time_global enable row level security;
alter table lead_time_warehouse enable row level security;
alter table lead_time_product_warehouse enable row level security;
alter table macship_failed_updates enable row level security;

-- lead_time_global: anyone can read, admin can manage
create policy "Anyone can read global lead time"
  on lead_time_global for select
  using (true);

create policy "Admins can manage global lead time"
  on lead_time_global for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- lead_time_warehouse: anyone can read, admin can manage
create policy "Anyone can read warehouse lead times"
  on lead_time_warehouse for select
  using (true);

create policy "Admins can manage warehouse lead times"
  on lead_time_warehouse for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- lead_time_product_warehouse: anyone can read, admin can manage
create policy "Anyone can read product warehouse lead times"
  on lead_time_product_warehouse for select
  using (true);

create policy "Admins can manage product warehouse lead times"
  on lead_time_product_warehouse for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- macship_failed_updates: admin only
create policy "Admins can read macship failed updates"
  on macship_failed_updates for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can manage macship failed updates"
  on macship_failed_updates for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
