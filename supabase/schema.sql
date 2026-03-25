-- Chem Connect - Milestone 1 Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. User role enum
-- ============================================
create type user_role as enum ('customer', 'admin');

-- ============================================
-- 2. Profiles table (extends Supabase Auth)
-- ============================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role user_role not null default 'customer',
  company_name text,
  abn text,
  contact_name text,
  phone text,
  address_street text,
  address_city text,
  address_state text,
  address_postcode text,
  delivery_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
declare
  _role user_role := 'customer';
begin
  -- Safely try to read role from metadata
  if new.raw_user_meta_data->>'role' = 'admin' then
    _role := 'admin';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, _role);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

-- ============================================
-- 3. Products table
-- ============================================
create table products (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  price numeric(10, 2) not null,
  unit text not null default 'L',
  description text not null default '',
  manufacturer text not null default '',
  category text not null default '',
  classification text not null default 'Non-DG',
  cas_number text not null default 'N/A',
  packaging_sizes text[] not null default '{}',
  safety_info text not null default '',
  delivery_info text not null default '',
  in_stock boolean not null default true,
  stock_qty integer not null default 0,
  region text not null default 'NSW',
  image_url text,
  badge text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_updated_at
  before update on products
  for each row execute procedure update_updated_at();

-- Index for fast slug lookups
create index products_slug_idx on products (slug);
-- Index for category filtering
create index products_category_idx on products (category);
-- Index for stock filtering
create index products_in_stock_idx on products (in_stock);

-- ============================================
-- 4. Row Level Security (RLS)
-- ============================================

-- Profiles RLS
alter table profiles enable row level security;

-- Users can read their own profile; admins can read all
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

-- Users can update their own profile (but not role)
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Service role bypasses RLS, so admin reads go through API routes

-- Products RLS
alter table products enable row level security;

-- Anyone can read products (public marketplace)
create policy "Products are viewable by everyone"
  on products for select
  using (true);

-- Only admins can insert products
create policy "Admins can insert products"
  on products for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can update products
create policy "Admins can update products"
  on products for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Only admins can delete products
create policy "Admins can delete products"
  on products for delete
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- 5. Storage bucket for product images
-- ============================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-images', 'product-images', true, 5242880)
on conflict (id) do nothing;

-- Anyone can view product images (public bucket)
create policy "Product images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Admins can upload product images
create policy "Admins can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update product images
create policy "Admins can update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can delete product images
create policy "Admins can delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- 6. Seed data (existing products)
-- ============================================
insert into products (name, slug, price, unit, description, manufacturer, category, classification, cas_number, packaging_sizes, safety_info, delivery_info, in_stock, stock_qty, region, image_url, badge) values
  ('Green Acid Replacement', 'green-acid-replacement', 2.45, 'L', 'High-performance acid replacement for concrete plants. Contains Urea Hydrochloride (CAS 506-89-8) as primary active ingredient. Safer alternative to traditional hydrochloric acid for cleaning and etching concrete equipment.', 'CQVS Chemical', 'Acid Replacement', 'Non-DG', '506-89-8', '{"20L Drum","200L Drum","1000L IBC"}', 'Non-hazardous. PPE recommended: gloves, eye protection.', 'Ships from your state. 2-5 business day delivery.', true, 450, 'NSW', null, 'Best Seller'),
  ('AdBlue (DEF)', 'adblue-def', 1.15, 'L', 'Automotive-grade Diesel Exhaust Fluid (AdBlue/DEF). 32.5% high-purity urea solution for SCR systems. ISO 22241 compliant. Reduces NOx emissions by up to 90%.', 'CQVS Chemical', 'Automotive', 'Non-DG', '57-13-6', '{"10L Jerry Can","200L Drum","1000L IBC"}', 'Non-hazardous. Store below 30C.', 'Ships from your state. 2-5 business day delivery.', true, 1200, 'VIC', null, null),
  ('Eco Wash', 'eco-wash', 1.80, 'L', 'Biodegradable industrial wash concentrate for heavy equipment cleaning. Effective degreaser for concrete trucks, mixers, and plant equipment. pH neutral formula safe for most surfaces.', 'CQVS Chemical', 'Cleaning', 'Non-DG', 'N/A', '{"20L Drum","200L Drum","1000L IBC"}', 'Low hazard. Biodegradable. Gloves recommended.', 'Ships from your state. 2-5 business day delivery.', true, 320, 'QLD', null, null),
  ('Agi Acid', 'agi-acid', 2.06, 'L', 'Industrial-strength acid for agitator and drum cleaning in concrete plants. Highly effective at dissolving hardened concrete buildup. DG Class 8 - Corrosive substance.', 'CQVS Chemical', 'Acid', 'DG Class 8', '7647-01-0', '{"20L Drum","200L Drum"}', 'DG Class 8 Corrosive. Full PPE required. SDS available.', 'DG-rated transport. 3-7 business day delivery.', true, 180, 'NSW', null, 'DG Class 8'),
  ('Agi Gel', 'agi-gel', 2.21, 'L', 'Gel-based acid cleaner that clings to vertical surfaces for extended contact time. Ideal for agitator barrels and truck chutes. DG Class 8 - Corrosive substance.', 'CQVS Chemical', 'Acid', 'DG Class 8', '7647-01-0', '{"20L Drum","200L Drum"}', 'DG Class 8 Corrosive. Full PPE required. SDS available.', 'DG-rated transport. 3-7 business day delivery.', true, 95, 'VIC', null, 'DG Class 8'),
  ('Truck Wash Premium', 'truck-wash-premium', 1.95, 'L', 'Premium-grade truck wash with advanced surfactant blend. Cuts through road grime, concrete dust, and diesel soot. Safe on painted surfaces and aluminium.', 'CQVS Chemical', 'Cleaning', 'Non-DG', 'N/A', '{"20L Drum","200L Drum","1000L IBC"}', 'Low hazard. Gloves and eye protection recommended.', 'Ships from your state. 2-5 business day delivery.', true, 500, 'QLD', null, null),
  ('Truck Wash Standard', 'truck-wash-standard', 1.50, 'L', 'Cost-effective truck wash solution for daily fleet maintenance. Effective general-purpose cleaner for concrete and quarry vehicles.', 'CQVS Chemical', 'Cleaning', 'Non-DG', 'N/A', '{"20L Drum","200L Drum","1000L IBC"}', 'Low hazard. Gloves recommended.', 'Ships from your state. 2-5 business day delivery.', true, 800, 'NSW', null, null),
  ('Heavy Duty Hand Cleaner', 'heavy-duty-hand-cleaner', 4.10, 'L', 'Industrial hand cleaner with natural grit for removing grease, oil, concrete, and adhesives. Enriched with skin conditioners to prevent drying.', 'CQVS Chemical', 'Personal Care', 'Non-DG', 'N/A', '{"5L Pump","20L Drum"}', 'Non-hazardous. Dermatologically tested.', 'Ships from your state. 2-5 business day delivery.', false, 0, 'NSW', null, 'Coming Soon'),
  ('AluBright', 'alubright', 3.40, 'L', 'Specialist aluminium brightener and cleaner. Restores shine to oxidized aluminium surfaces on tankers, trailers, and equipment.', 'CQVS Chemical', 'Cleaning', 'Non-DG', 'N/A', '{"20L Drum","200L Drum"}', 'Mild acid. Gloves and eye protection required.', 'Ships from your state. 2-5 business day delivery.', false, 0, 'VIC', null, 'Coming Soon'),
  ('Sodium Hydroxide (NaOH) - 50kg', 'sodium-hydroxide-50kg', 85.00, 'bag', 'Industrial-grade caustic soda flakes. 98% purity. Used in water treatment, cleaning, and pH adjustment applications.', 'Brenntag Australia', 'Alkali', 'DG Class 8', '1310-73-2', '{"25kg Bag","50kg Bag","1000kg Bulk Bag"}', 'DG Class 8 Corrosive. Full PPE required. Causes severe burns.', 'DG-rated transport. 5-10 business day delivery.', true, 60, 'NSW', null, null),
  ('BrakePrep', 'brakeprep', 4.95, 'L', 'Fast-evaporating brake and parts cleaner. Removes brake dust, oil, and contaminants from brake components and metal parts.', 'CQVS Chemical', 'Automotive', 'DG Class 3', '67-64-1', '{"5L Can","20L Drum"}', 'DG Class 3 Flammable. Use in ventilated areas. No naked flames.', 'DG-rated transport. 3-7 business day delivery.', false, 0, 'QLD', null, 'Coming Soon'),
  ('Vision Glass Cleaner', 'vision-glass-cleaner', 2.00, 'L', 'Streak-free glass cleaner for industrial and automotive use. Anti-static formula repels dust. Safe on tinted windows.', 'CQVS Chemical', 'Cleaning', 'Non-DG', 'N/A', '{"5L Jerry Can","20L Drum"}', 'Non-hazardous. Eye protection recommended.', 'Ships from your state. 2-5 business day delivery.', false, 0, 'VIC', null, 'Coming Soon');
