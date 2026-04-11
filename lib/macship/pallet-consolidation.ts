/**
 * Pallet consolidation logic for Machship shipping quotes.
 *
 * Approved by CQVS (Jonny Harper, April 2026 — "Option B").
 *
 * The problem: when a customer orders multiple units of a packaging size
 * (e.g. 2 × 20L drums), each drum doesn't need its own pallet — they fit
 * on a shared pallet. Sending Machship "qty=2 of pallets" makes the
 * customer pay for 2 pallet rates instead of 1, which is a ~$45 overcharge
 * on a 2-drum order.
 *
 * The fix: for each cart line, calculate the minimum number of pallets
 * needed based on the packaging size, then send that many pallet items to
 * Machship with the correct aggregated weight per pallet.
 *
 * Single-unit 20L containers are still sent as Carton (Aramex parcel rates).
 *
 * If the consolidation rules ever need to vary by warehouse, customer, or
 * product family, this file is the only place to change them.
 */

import {
  MachshipItemType,
  type MachshipItem,
  type MachshipItemTypeValue,
} from "./client"

// ============================================================
// Capacity tables — units per standard 1.2m × 1.0m AU pallet
// ============================================================

/**
 * How many physical units of each packaging size fit on a single pallet.
 * Based on CQVS warehouse practice; can be adjusted as needed.
 */
const PALLET_CAPACITY: Record<string, number> = {
  "5l": 80, // 5L jerry cans
  "10l": 48, // 10L jerry cans
  "20l": 16, // 20L drums or 20L jerry cans
  "200l": 4, // 200L drums
  "1000l": 1, // 1000L IBC — IS its own pallet
}

/** Estimated weight in kg of one filled unit at this packaging size */
const UNIT_WEIGHT_KG: Record<string, number> = {
  "5l": 7,
  "10l": 12,
  "20l": 25,
  "200l": 220,
  "1000l": 1100,
}

/** Map a packaging size name to its capacity bucket key */
export function getCapacityKey(packagingSizeName: string): string | null {
  if (/1000\s*l|ibc/i.test(packagingSizeName)) return "1000l"
  if (/\b200\s*l\b/i.test(packagingSizeName)) return "200l"
  if (/(?<!\d)20\s*l/i.test(packagingSizeName)) return "20l"
  if (/(?<!\d)10\s*l/i.test(packagingSizeName)) return "10l"
  if (/(?<!\d)5\s*l/i.test(packagingSizeName)) return "5l"
  return null
}

/**
 * Returns true if the packaging size is a 20L container (any type —
 * drum, jerry can, pail, etc.). Does not match 200L or 1000L.
 */
export function is20LContainer(packagingSizeName: string): boolean {
  return getCapacityKey(packagingSizeName) === "20l"
}

// ============================================================
// Cart-line input shape
// ============================================================

export interface ConsolidationInput {
  product_name: string
  packaging_size_name: string
  packaging_size_id?: string | null
  quantity: number
}

/**
 * Admin-configured capacity overrides per packaging_size id.
 * When provided, takes precedence over the hardcoded PALLET_CAPACITY /
 * UNIT_WEIGHT_KG fallback tables.
 *
 * Built from the `packaging_sizes` table by the calling route — see
 * the quote/orders routes for examples.
 */
export interface PackagingCapacityOverride {
  unitsPerPallet: number | null
  unitWeightKg: number | null
  /** The capacity bucket key inferred from the size name (e.g. "20l") */
  fallbackKey: string | null
}

export type PackagingCapacityMap = Map<string, PackagingCapacityOverride>

// ============================================================
// Main consolidation — whole cart at once
// ============================================================

/**
 * Convert an entire cart into the minimum number of Machship items by
 * aggregating all lines that share a packaging size key onto shared
 * pallets.
 *
 * This is "Option B" as approved by CQVS (Jonny Harper, April 2026):
 *  > Smart consolidation — aggregate multiple drums onto a single pallet
 *  > for the quote, customer pays accurate Hi Trans cost.
 *
 * Rules:
 *  1. If the entire cart is exactly 1 × 20L container → Carton (Aramex parcel)
 *  2. For every other case, group cart lines by packaging size key
 *     (5L / 10L / 20L / 200L / 1000L):
 *     - 1000L IBCs are never consolidated — each is its own pallet
 *     - For every other group, sum the quantity across ALL lines sharing
 *       that key, then calculate pallets needed = ceil(total_qty / capacity)
 *       and weight per pallet = (total_qty × unit_weight) / pallets_needed
 *     - Produces one Machship item per group
 *  3. Unknown packaging sizes fall back to one Pallet line per cart line
 *     (legacy safety net)
 *
 * Example — cart with `5 × 20L Eco Wash + 5 × 20L Truck Wash`:
 *   - Before: 2 pallet lines, each qty=1 with ~125 kg → 2 pallet rates
 *   - After:  1 pallet line, qty=1 with 250 kg → 1 pallet rate
 */
/**
 * Resolve the effective pallet capacity for a cart line.
 * Order of preference:
 *   1. Admin-configured value from the `packaging_sizes` table (via override map)
 *   2. Hardcoded PALLET_CAPACITY / UNIT_WEIGHT_KG fallback table
 *   3. null if neither knows about this packaging size
 */
function resolveCapacity(
  line: ConsolidationInput,
  overrides?: PackagingCapacityMap,
): { capacity: number; unitWeight: number; key: string | null } | null {
  // Try admin override first
  if (overrides && line.packaging_size_id) {
    const override = overrides.get(line.packaging_size_id)
    if (
      override &&
      typeof override.unitsPerPallet === "number" &&
      override.unitsPerPallet > 0 &&
      typeof override.unitWeightKg === "number" &&
      override.unitWeightKg > 0
    ) {
      return {
        capacity: override.unitsPerPallet,
        unitWeight: override.unitWeightKg,
        key: override.fallbackKey,
      }
    }
  }

  // Fall back to hardcoded defaults
  const key = getCapacityKey(line.packaging_size_name)
  if (key && PALLET_CAPACITY[key] && UNIT_WEIGHT_KG[key]) {
    return {
      capacity: PALLET_CAPACITY[key],
      unitWeight: UNIT_WEIGHT_KG[key],
      key,
    }
  }

  return null
}

export function buildConsolidatedCart(
  cartItems: ConsolidationInput[],
  overrides?: PackagingCapacityMap,
): MachshipItem[] {
  // 1. Single 20L container → Carton (Aramex)
  if (isSingle20LCart(cartItems)) {
    const line = cartItems[0]
    const resolved = resolveCapacity(line, overrides)
    return [
      {
        itemType: MachshipItemType.Carton,
        name: line.product_name,
        sku: line.packaging_size_id ?? undefined,
        quantity: 1,
        weight: resolved?.unitWeight ?? UNIT_WEIGHT_KG["20l"],
        length: 30,
        width: 30,
        height: 40,
      },
    ]
  }

  // 2. Group cart lines by capacity bucket key
  // - For IBCs (1000L) and unknown sizes, each cart line gets its own group.
  // - For everything else, lines sharing a packaging size key consolidate
  //   onto shared pallets.
  interface Group {
    key: string | null
    totalQuantity: number
    capacity: number | null
    unitWeight: number | null
    representativeLine: ConsolidationInput
  }
  const groups: Group[] = []
  const groupIndex = new Map<string, number>()

  for (const line of cartItems) {
    const resolved = resolveCapacity(line, overrides)
    const groupKey = resolved?.key ?? null

    // IBCs and unknown sizes never share a pallet with anything else
    if (groupKey === "1000l" || groupKey === null) {
      groups.push({
        key: groupKey,
        totalQuantity: line.quantity,
        capacity: resolved?.capacity ?? null,
        unitWeight: resolved?.unitWeight ?? null,
        representativeLine: line,
      })
      continue
    }

    // Everything else: group by capacity key across the whole cart
    const existingIdx = groupIndex.get(groupKey)
    if (existingIdx !== undefined) {
      groups[existingIdx].totalQuantity += line.quantity
      continue
    }
    groupIndex.set(groupKey, groups.length)
    groups.push({
      key: groupKey,
      totalQuantity: line.quantity,
      capacity: resolved?.capacity ?? null,
      unitWeight: resolved?.unitWeight ?? null,
      representativeLine: line,
    })
  }

  // 3. Build one or more Machship items per group
  const items: MachshipItem[] = []
  for (const g of groups) {
    const line = g.representativeLine

    // IBC — one item per IBC (not consolidatable)
    if (g.key === "1000l") {
      items.push({
        itemType: MachshipItemType.IBC,
        name: line.product_name,
        sku: line.packaging_size_id ?? undefined,
        quantity: g.totalQuantity,
        weight: g.unitWeight ?? UNIT_WEIGHT_KG["1000l"],
        length: 120,
        width: 100,
        height: 116,
        palletSpaces: 1,
      })
      continue
    }

    // Known capacity → consolidate to minimum pallets
    if (g.capacity && g.unitWeight) {
      const palletsNeeded = Math.max(1, Math.ceil(g.totalQuantity / g.capacity))
      const totalWeight = g.unitWeight * g.totalQuantity
      const weightPerPallet = Math.round((totalWeight / palletsNeeded) * 100) / 100

      items.push({
        itemType: MachshipItemType.Pallet,
        name: line.product_name,
        sku: line.packaging_size_id ?? undefined,
        quantity: palletsNeeded,
        weight: weightPerPallet,
        length: 120,
        width: 100,
        height: 100,
        palletSpaces: 1,
      })
      continue
    }

    // Unknown packaging size → fallback (1 pallet per unit)
    items.push({
      itemType: MachshipItemType.Pallet,
      name: line.product_name,
      sku: line.packaging_size_id ?? undefined,
      quantity: g.totalQuantity,
      weight: 25,
      length: 120,
      width: 100,
      height: 100,
      palletSpaces: 1,
    })
  }

  return items
}

/**
 * Build a `PackagingCapacityMap` from a list of packaging_sizes rows
 * (as returned by `SELECT * FROM packaging_sizes`).
 *
 * Use this in routes that have packaging_sizes data available — pass the
 * resulting map to `buildConsolidatedCart` so admin-configured capacities
 * take precedence over the hardcoded defaults.
 */
export function buildCapacityMap(
  packagingSizes: Array<{
    id: string
    name: string
    units_per_pallet: number | null
    unit_weight_kg: number | null
  }>,
): PackagingCapacityMap {
  const map: PackagingCapacityMap = new Map()
  for (const ps of packagingSizes) {
    map.set(ps.id, {
      unitsPerPallet: ps.units_per_pallet,
      unitWeightKg: ps.unit_weight_kg,
      fallbackKey: getCapacityKey(ps.name),
    })
  }
  return map
}

/**
 * Detect whether the entire cart is a single unit of a 20L container —
 * the only case where we send Carton (Aramex parcel) instead of Pallet.
 */
export function isSingle20LCart(
  cartItems: Array<{ packaging_size_name: string; quantity: number }>,
): boolean {
  return (
    cartItems.length === 1 &&
    cartItems[0].quantity === 1 &&
    is20LContainer(cartItems[0].packaging_size_name)
  )
}
