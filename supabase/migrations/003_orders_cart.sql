-- Milestone 2: Orders, Order Items, and Cart tables
-- Run this in the Supabase SQL Editor

-- ============================================
-- 1. Order status enum
-- ============================================
create type order_status as enum ('received', 'processing', 'in_transit', 'delivered', 'cancelled');
create type payment_method as enum ('stripe', 'purchase_order');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

-- ============================================
-- 2. Orders table
-- ============================================
create table orders (
  id uuid not null default uuid_generate_v4() primary key,
  order_number text not null unique,
  user_id uuid not null references auth.users on delete cascade,
  status order_status not null default 'received',
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  stripe_payment_intent_id text,
  po_number text,
  subtotal numeric(10, 2) not null default 0,
  shipping numeric(10, 2) not null default 0,
  gst numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  delivery_address_street text,
  delivery_address_city text,
  delivery_address_state text,
  delivery_address_postcode text,
  delivery_notes text,
  tracking_number text,
  estimated_delivery date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_updated_at
  before update on orders
  for each row execute procedure update_updated_at();

-- Indexes
create index orders_user_id_idx on orders (user_id);
create index orders_status_idx on orders (status);
create index orders_order_number_idx on orders (order_number);
create index orders_created_at_idx on orders (created_at desc);

-- ============================================
-- 3. Order items table
-- ============================================
create table order_items (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  product_id uuid not null references products on delete restrict,
  product_name text not null,
  product_image_url text,
  quantity integer not null default 1,
  unit text not null default 'L',
  packaging_size text not null default '',
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on order_items (order_id);

-- ============================================
-- 4. Cart items table (persistent cart)
-- ============================================
create table cart_items (
  id uuid not null default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users on delete cascade,
  product_id uuid not null references products on delete cascade,
  quantity integer not null default 1,
  packaging_size text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, packaging_size)
);

create trigger cart_items_updated_at
  before update on cart_items
  for each row execute procedure update_updated_at();

create index cart_items_user_id_idx on cart_items (user_id);

-- ============================================
-- 5. Order status history (for tracking timeline)
-- ============================================
create table order_status_history (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  status order_status not null,
  note text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create index order_status_history_order_id_idx on order_status_history (order_id);

-- ============================================
-- 6. Sequence for order numbers (ORD-000001)
-- ============================================
create sequence order_number_seq start 1;

create or replace function generate_order_number()
returns trigger as $$
begin
  new.order_number := 'ORD-' || lpad(nextval('order_number_seq')::text, 6, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_order_number
  before insert on orders
  for each row
  when (new.order_number is null or new.order_number = '')
  execute procedure generate_order_number();

-- Auto-insert status history on order creation
create or replace function log_initial_order_status()
returns trigger as $$
begin
  insert into order_status_history (order_id, status, note, created_by)
  values (new.id, new.status, 'Order placed', new.user_id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_order_created
  after insert on orders
  for each row execute procedure log_initial_order_status();

-- Auto-log status changes
create or replace function log_order_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into order_status_history (order_id, status, note)
    values (new.id, new.status, 'Status updated to ' || new.status::text);
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_order_status_changed
  after update on orders
  for each row execute procedure log_order_status_change();

-- ============================================
-- 7. RLS Policies
-- ============================================

-- Orders RLS
alter table orders enable row level security;

create policy "Users can view own orders"
  on orders for select
  using (auth.uid() = user_id);

create policy "Users can create own orders"
  on orders for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all orders"
  on orders for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can update all orders"
  on orders for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Order items RLS
alter table order_items enable row level security;

create policy "Users can view own order items"
  on order_items for select
  using (
    exists (
      select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

create policy "Service can insert order items"
  on order_items for insert
  with check (true);

create policy "Admins can view all order items"
  on order_items for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Cart items RLS
alter table cart_items enable row level security;

create policy "Users can manage own cart"
  on cart_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Order status history RLS
alter table order_status_history enable row level security;

create policy "Users can view own order history"
  on order_status_history for select
  using (
    exists (
      select 1 from orders where orders.id = order_status_history.order_id and orders.user_id = auth.uid()
    )
  );

create policy "Admins can view all status history"
  on order_status_history for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can insert status history"
  on order_status_history for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
