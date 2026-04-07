-- Migration 023: Signup & checkout field additions
-- Adds invoice_email to profiles, forklift/invoice_email/container_cost to orders.

-- ============================================
-- 1. profiles: invoice_email + xero_contact_id
-- ============================================
alter table profiles
  add column if not exists invoice_email text,
  add column if not exists xero_contact_id text,
  add column if not exists accepted_payment_terms_at timestamptz;

-- ============================================
-- 2. orders: invoice_email, forklift, xero links, warehouse, container_total
-- ============================================
alter table orders
  add column if not exists invoice_email text,
  add column if not exists forklift_available boolean,
  add column if not exists container_total numeric(10, 2) not null default 0,
  add column if not exists warehouse_id uuid references warehouses on delete set null,
  add column if not exists xero_invoice_id text,
  add column if not exists xero_invoice_number text,
  add column if not exists xero_invoice_status text,
  add column if not exists xero_po_id text,
  add column if not exists xero_po_number text,
  add column if not exists xero_synced_at timestamptz;

-- ============================================
-- 3. order_items: container cost + packaging size reference
-- ============================================
alter table order_items
  add column if not exists packaging_size_id uuid references packaging_sizes on delete set null,
  add column if not exists packaging_volume_litres numeric(10, 2),
  add column if not exists price_type product_price_type,
  add column if not exists container_cost numeric(10, 2) not null default 0;

-- ============================================
-- 4. cart_items: packaging size reference
-- ============================================
alter table cart_items
  add column if not exists packaging_size_id uuid references packaging_sizes on delete set null;
