-- Migration 026: Pallet capacity per packaging size
--
-- Adds two columns to packaging_sizes so the admin can maintain how many
-- physical units of each packaging size fit on a single pallet, and how
-- much each unit weighs (in kg). This data is used by the Machship quote
-- consolidation logic to send accurate pallet counts and weights — so the
-- customer pays the correct per-pallet shipping rate instead of being
-- charged for each unit as if it were on its own pallet.
--
-- Approved by CQVS (Jonny Harper, April 2026 — "Option B").

alter table packaging_sizes
  add column if not exists units_per_pallet integer,
  add column if not exists unit_weight_kg numeric(10, 2);

-- Seed sensible defaults for the standard sizes already in the table.
-- Admin can override any of these via the Packaging Sizes admin tab.
update packaging_sizes set units_per_pallet = 80, unit_weight_kg = 7
  where name = '5L Jerry Can' and (units_per_pallet is null or unit_weight_kg is null);

update packaging_sizes set units_per_pallet = 48, unit_weight_kg = 12
  where name = '10L Jerry Can' and (units_per_pallet is null or unit_weight_kg is null);

update packaging_sizes set units_per_pallet = 16, unit_weight_kg = 25
  where name = '20L Drum' and (units_per_pallet is null or unit_weight_kg is null);

update packaging_sizes set units_per_pallet = 4, unit_weight_kg = 220
  where name = '200L Drum' and (units_per_pallet is null or unit_weight_kg is null);

-- 1000L IBC is its own pallet (capacity = 1)
update packaging_sizes set units_per_pallet = 1, unit_weight_kg = 1100
  where name = '1000L IBC' and (units_per_pallet is null or unit_weight_kg is null);

-- Bags — best-guess defaults; admin should adjust as needed
update packaging_sizes set units_per_pallet = 40, unit_weight_kg = 25
  where name = '25kg Bag' and (units_per_pallet is null or unit_weight_kg is null);

update packaging_sizes set units_per_pallet = 20, unit_weight_kg = 50
  where name = '50kg Bag' and (units_per_pallet is null or unit_weight_kg is null);

update packaging_sizes set units_per_pallet = 1, unit_weight_kg = 1000
  where name = '1000kg Bulk Bag' and (units_per_pallet is null or unit_weight_kg is null);
