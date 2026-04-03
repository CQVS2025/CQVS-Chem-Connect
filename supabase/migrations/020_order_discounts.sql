-- Store discount breakdown on orders for display in dashboards
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_discount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_order_discount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_order_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount numeric(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_names text;
