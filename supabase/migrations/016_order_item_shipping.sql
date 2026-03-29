-- Add shipping_fee to order_items as a snapshot of the product's shipping fee at order time
alter table order_items add column if not exists shipping_fee numeric(10, 2) not null default 0;
