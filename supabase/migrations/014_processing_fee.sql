-- Add processing_fee column to orders table
-- Only applies to card (Stripe) payments, not PO orders
alter table orders add column if not exists processing_fee numeric(10, 2) not null default 0;
