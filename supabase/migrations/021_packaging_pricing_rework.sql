-- Migration 021: Packaging Sizes & Per-Size Pricing Rework
-- Adds master packaging sizes table, per-product per-size pricing,
-- price type flag (per_litre vs fixed), and warehouse-specific container costs.

-- ============================================
-- 1. Master packaging sizes table (dropdown source)
-- ============================================
create table if not exists packaging_sizes (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null unique,
  volume_litres numeric(10, 2),
  container_type text not null default 'drum',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger packaging_sizes_updated_at
  before update on packaging_sizes
  for each row execute procedure update_updated_at();

-- Seed common packaging sizes
insert into packaging_sizes (name, volume_litres, container_type, sort_order) values
  ('5L Jerry Can', 5, 'jerry_can', 10),
  ('10L Jerry Can', 10, 'jerry_can', 20),
  ('20L Drum', 20, 'drum', 30),
  ('200L Drum', 200, 'drum', 40),
  ('1000L IBC', 1000, 'ibc', 50),
  ('25kg Bag', null, 'bag', 60),
  ('50kg Bag', null, 'bag', 70),
  ('1000kg Bulk Bag', null, 'bag', 80)
on conflict (name) do nothing;

-- ============================================
-- 2. Add price_type to products
-- ============================================
do $$ begin
  create type product_price_type as enum ('per_litre', 'fixed');
exception
  when duplicate_object then null;
end $$;

alter table products
  add column if not exists price_type product_price_type not null default 'per_litre';

-- ============================================
-- 3. Per-product per-size pricing
-- ============================================
create table if not exists product_packaging_prices (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  packaging_size_id uuid not null references packaging_sizes on delete restrict,
  price_per_litre numeric(10, 4),
  fixed_price numeric(10, 2),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, packaging_size_id)
);

create trigger product_packaging_prices_updated_at
  before update on product_packaging_prices
  for each row execute procedure update_updated_at();

create index product_packaging_prices_product_id_idx
  on product_packaging_prices (product_id);

-- ============================================
-- 4. RLS Policies
-- ============================================
alter table packaging_sizes enable row level security;
alter table product_packaging_prices enable row level security;

create policy "Anyone can read packaging sizes"
  on packaging_sizes for select
  using (true);

create policy "Admins can manage packaging sizes"
  on packaging_sizes for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Anyone can read product packaging prices"
  on product_packaging_prices for select
  using (true);

create policy "Admins can manage product packaging prices"
  on product_packaging_prices for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
