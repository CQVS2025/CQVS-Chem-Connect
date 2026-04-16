-- Migration 030: Minimum Order Quantity (MOQ) per product packaging size
--
-- Adds minimum_order_quantity to product_packaging_prices so each
-- product+size combo can have its own floor (e.g. 1L Drum MOQ 6, IBC MOQ 2).
-- Defaults to 1 so all existing rows behave the same as before.

alter table product_packaging_prices
  add column if not exists minimum_order_quantity integer not null default 1;

-- Ensure MOQ is always at least 1
alter table product_packaging_prices
  add constraint product_packaging_prices_moq_min check (minimum_order_quantity >= 1);
