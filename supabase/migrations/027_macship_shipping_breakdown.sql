-- Migration 027: Store Machship shipping quote breakdown on orders
--
-- Saves the full pricing transparency data (base rate, fuel levy,
-- tailgate surcharge, other surcharges, tax, carrier service, ETA)
-- so order pages can display it to both customers and admins.

alter table orders
  add column if not exists macship_shipping_breakdown jsonb,
  add column if not exists macship_service_name text,
  add column if not exists macship_eta_date date,
  add column if not exists macship_eta_business_days integer;
