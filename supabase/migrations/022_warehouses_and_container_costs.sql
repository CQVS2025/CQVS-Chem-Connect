-- Migration 022: Warehouses, container costs, warehouse-specific pricing
-- Foundation for MacShip integration and Xero purchase orders.

-- ============================================
-- 1. Warehouses table
-- ============================================
create table if not exists warehouses (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  address_street text not null,
  address_city text not null,
  address_state text not null,
  address_postcode text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  xero_contact_id text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger warehouses_updated_at
  before update on warehouses
  for each row execute procedure update_updated_at();

-- Seed the 5 known warehouses (addresses to be filled in by admin)
insert into warehouses (name, address_street, address_city, address_state, address_postcode, sort_order) values
  ('ChemBuild Industries', 'TBD', 'Dandenong South', 'VIC', '3175', 10),
  ('Environex (QLD)', 'Platinum St', 'Crestmead', 'QLD', '4132', 20),
  ('Chemology', 'TBD', 'Lonsdale', 'SA', '5160', 30),
  ('Environex (WA)', 'TBD', 'TBD', 'WA', 'TBD', 40),
  ('Formula Chemicals', 'TBD', 'West Ryde', 'NSW', '2114', 50)
on conflict do nothing;

-- ============================================
-- 2. Container costs (per warehouse, per packaging size)
-- ============================================
create table if not exists container_costs (
  id uuid not null default uuid_generate_v4() primary key,
  warehouse_id uuid not null references warehouses on delete cascade,
  packaging_size_id uuid not null references packaging_sizes on delete cascade,
  cost numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, packaging_size_id)
);

create trigger container_costs_updated_at
  before update on container_costs
  for each row execute procedure update_updated_at();

-- ============================================
-- 3. Warehouse product pricing (cost price for Xero POs)
-- ============================================
create table if not exists warehouse_product_pricing (
  id uuid not null default uuid_generate_v4() primary key,
  warehouse_id uuid not null references warehouses on delete cascade,
  product_id uuid not null references products on delete cascade,
  packaging_size_id uuid not null references packaging_sizes on delete cascade,
  cost_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, product_id, packaging_size_id)
);

create trigger warehouse_product_pricing_updated_at
  before update on warehouse_product_pricing
  for each row execute procedure update_updated_at();

create index warehouse_product_pricing_warehouse_idx
  on warehouse_product_pricing (warehouse_id);
create index warehouse_product_pricing_product_idx
  on warehouse_product_pricing (product_id);

-- ============================================
-- 4. Product-warehouse availability mapping
-- ============================================
create table if not exists product_warehouses (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  warehouse_id uuid not null references warehouses on delete cascade,
  created_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

create index product_warehouses_product_idx on product_warehouses (product_id);
create index product_warehouses_warehouse_idx on product_warehouses (warehouse_id);

-- ============================================
-- 5. RLS Policies
-- ============================================
alter table warehouses enable row level security;
alter table container_costs enable row level security;
alter table warehouse_product_pricing enable row level security;
alter table product_warehouses enable row level security;

-- Warehouses: anyone can read active ones, admins manage
create policy "Anyone can read active warehouses"
  on warehouses for select
  using (is_active = true);

create policy "Admins can manage warehouses"
  on warehouses for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Container costs: anyone reads (needed at checkout), admins manage
create policy "Anyone can read container costs"
  on container_costs for select
  using (true);

create policy "Admins can manage container costs"
  on container_costs for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Warehouse pricing: admin only (cost prices are sensitive)
create policy "Admins can read warehouse pricing"
  on warehouse_product_pricing for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can manage warehouse pricing"
  on warehouse_product_pricing for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Product-warehouse mapping: anyone reads, admins manage
create policy "Anyone can read product warehouses"
  on product_warehouses for select
  using (true);

create policy "Admins can manage product warehouses"
  on product_warehouses for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
