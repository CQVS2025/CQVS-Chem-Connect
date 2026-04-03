-- Enhance promotions table with additional fields for full customization
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS eligible_product_ids uuid[] DEFAULT '{}';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS display_style text DEFAULT 'card';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS fine_print text;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS promotion_type_detail text;
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS buy_quantity integer DEFAULT 0;
