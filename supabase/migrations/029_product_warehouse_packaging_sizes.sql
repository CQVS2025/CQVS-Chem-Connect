-- Migration 029: Product-warehouse mapping at packaging-size granularity
-- Allows specific packaging sizes of a product to be mapped to specific
-- warehouses (e.g. "Agi Acid 1000L IBC at Formula Chemicals, but NOT 20L Drum").
--
-- Existing rows (packaging_size_id IS NULL) mean "all sizes available" at that
-- warehouse — legacy/catch-all behaviour is preserved.

-- 1. Drop the old unique constraint on (product_id, warehouse_id)
alter table product_warehouses
  drop constraint if exists product_warehouses_product_id_warehouse_id_key;

-- 2. Add nullable packaging_size_id column
alter table product_warehouses
  add column if not exists packaging_size_id uuid
    references packaging_sizes (id) on delete cascade;

-- 3. New unique constraint that handles NULLs correctly via partial indexes.
--    NULL means "all sizes", and two NULL values are considered equal here,
--    so we enforce uniqueness for the null case separately.

-- (a) When packaging_size_id IS NOT NULL: unique per (product, warehouse, size)
create unique index if not exists product_warehouses_product_warehouse_size_idx
  on product_warehouses (product_id, warehouse_id, packaging_size_id)
  where packaging_size_id is not null;

-- (b) When packaging_size_id IS NULL: only one "all sizes" row per (product, warehouse)
create unique index if not exists product_warehouses_product_warehouse_null_idx
  on product_warehouses (product_id, warehouse_id)
  where packaging_size_id is null;

-- 4. Index for efficient lookups by packaging_size_id
create index if not exists product_warehouses_packaging_size_idx
  on product_warehouses (packaging_size_id);
