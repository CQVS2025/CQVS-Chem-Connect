-- Add per-product shipping fee
-- NULL or 0 means free shipping for that product
alter table products add column if not exists shipping_fee numeric(10, 2) not null default 0;
