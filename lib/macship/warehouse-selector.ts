/**
 * Warehouse selector for MacShip shipments.
 *
 * Given a customer's cart and delivery postcode, selects the best warehouse
 * to fulfil the order. Prefers warehouses that carry all products; scores by
 * proximity using postcode-to-state mapping.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ============================================================
// Types
// ============================================================

export interface WarehouseSelectionResult {
  warehouse: {
    id: string
    name: string
    address_street: string
    address_city: string
    address_state: string
    address_postcode: string
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
  }
  /** true if no single warehouse stocks all cart products */
  isPartialFulfillment: boolean
  /** product IDs not available at the selected warehouse */
  missingProductIds: string[]
}

// ============================================================
// Postcode → state mapping
// ============================================================
// AU postcode ranges (approximate; sufficient for proximity scoring):
//   NSW: 1000-1999, 2000-2599, 2619-2899, 2921-2999
//   ACT: 200-299 (PO boxes), 2600-2618, 2900-2920
//   VIC: 3000-3999, 8000-8999 (LVRs)
//   QLD: 4000-4999, 9000-9999 (LVRs)
//   SA:  5000-5999
//   WA:  6000-6797, 6800-6999
//   TAS: 7000-7999
//   NT:  800-899, 900-999

function postcodeToState(postcode: string): string {
  const pc = parseInt(postcode.replace(/\D/g, ""), 10)
  if (isNaN(pc)) return "NSW" // safe default

  if (pc >= 200 && pc <= 299) return "ACT"
  if (pc >= 800 && pc <= 999) return "NT"
  if (pc >= 1000 && pc <= 2599) return "NSW"
  if (pc >= 2600 && pc <= 2618) return "ACT"
  if (pc >= 2619 && pc <= 2899) return "NSW"
  if (pc >= 2900 && pc <= 2920) return "ACT"
  if (pc >= 2921 && pc <= 2999) return "NSW"
  if (pc >= 3000 && pc <= 3999) return "VIC"
  if (pc >= 4000 && pc <= 4999) return "QLD"
  if (pc >= 5000 && pc <= 5999) return "SA"
  if (pc >= 6000 && pc <= 6999) return "WA"
  if (pc >= 7000 && pc <= 7999) return "TAS"
  if (pc >= 8000 && pc <= 8999) return "VIC"
  if (pc >= 9000 && pc <= 9999) return "QLD"

  return "NSW"
}

// ============================================================
// Proximity scoring
// ============================================================
// Score 1 = same state (best), 2 = adjacent, 3 = other

const ADJACENT_STATES: Record<string, string[]> = {
  VIC: ["NSW", "SA", "TAS"],
  NSW: ["VIC", "QLD", "ACT", "SA"],
  QLD: ["NSW", "NT", "SA"],
  SA:  ["VIC", "NSW", "QLD", "WA", "NT"],
  WA:  ["SA", "NT"],
  TAS: ["VIC"],
  ACT: ["NSW"],
  NT:  ["QLD", "SA", "WA"],
}

function proximityScore(warehouseState: string, deliveryState: string): number {
  const ws = warehouseState.toUpperCase()
  const ds = deliveryState.toUpperCase()
  if (ws === ds) return 1
  if (ADJACENT_STATES[ws]?.includes(ds)) return 2
  return 3
}

// ============================================================
// Main selector
// ============================================================

export async function selectWarehouse(
  cartItems: Array<{ product_id: string; packaging_size_id?: string }>,
  deliveryPostcode: string,
  supabase: SupabaseClient,
): Promise<WarehouseSelectionResult> {
  const deliveryState = postcodeToState(deliveryPostcode)

  // 1. Get all active warehouses
  const { data: warehouses, error: whError } = await supabase
    .from("warehouses")
    .select(
      "id, name, address_street, address_city, address_state, address_postcode, contact_name, contact_email, contact_phone",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (whError || !warehouses || warehouses.length === 0) {
    throw new Error(
      `No active warehouses found: ${whError?.message ?? "empty result"}`,
    )
  }

  // Build composite keys for each cart item: "product_id:packaging_size_id"
  // (or just "product_id:" if no size — shouldn't happen in practice)
  const cartKeys = cartItems.map(
    (i) => `${i.product_id}:${i.packaging_size_id ?? ""}`,
  )
  const distinctCartKeys = [...new Set(cartKeys)]
  const distinctProductIds = [
    ...new Set(cartItems.map((i) => i.product_id)),
  ]

  if (distinctProductIds.length === 0) {
    // No products — return first warehouse as a safe default
    const fallback = warehouses[0]
    return {
      warehouse: fallback,
      isPartialFulfillment: false,
      missingProductIds: [],
    }
  }

  // 2. For each warehouse, find which cart product+size combos it stocks.
  //    We also fetch packaging_size_id so we can distinguish:
  //      - NULL  => "all sizes" for this product at this warehouse
  //      - uuid  => only that specific size
  const { data: mappings, error: mapError } = await supabase
    .from("product_warehouses")
    .select("product_id, warehouse_id, packaging_size_id")
    .in("product_id", distinctProductIds)
    .in(
      "warehouse_id",
      warehouses.map((w) => w.id),
    )

  if (mapError) {
    throw new Error(`product_warehouses query failed: ${mapError.message}`)
  }

  // Build set of product+size composite keys per warehouse.
  // For a mapping with packaging_size_id = NULL ("all sizes"), we expand it
  // to cover every cart item for that product.
  const warehouseProductSets: Record<string, Set<string>> = {}
  for (const m of mappings ?? []) {
    if (!warehouseProductSets[m.warehouse_id]) {
      warehouseProductSets[m.warehouse_id] = new Set()
    }
    if (m.packaging_size_id === null) {
      // "All sizes" mapping — add a composite key for every cart item with this product
      for (const item of cartItems) {
        if (item.product_id === m.product_id) {
          warehouseProductSets[m.warehouse_id].add(
            `${item.product_id}:${item.packaging_size_id ?? ""}`,
          )
        }
      }
    } else {
      warehouseProductSets[m.warehouse_id].add(
        `${m.product_id}:${m.packaging_size_id}`,
      )
    }
  }

  // 3. Find warehouses that carry ALL cart product+size combos
  const fullWarehouseIds = warehouses
    .map((w) => w.id)
    .filter((id) => {
      const set = warehouseProductSets[id] ?? new Set()
      return distinctCartKeys.every((key) => set.has(key))
    })

  if (fullWarehouseIds.length > 0) {
    // 4. Score by proximity; pick best
    let bestWarehouse = warehouses.find((w) => w.id === fullWarehouseIds[0])!
    let bestScore = proximityScore(bestWarehouse.address_state, deliveryState)

    for (const whId of fullWarehouseIds.slice(1)) {
      const wh = warehouses.find((w) => w.id === whId)!
      const score = proximityScore(wh.address_state, deliveryState)
      if (score < bestScore) {
        bestScore = score
        bestWarehouse = wh
      }
    }

    return {
      warehouse: bestWarehouse,
      isPartialFulfillment: false,
      missingProductIds: [],
    }
  }

  // 5. No single warehouse has all product+size combos — partial fulfillment
  // Pick the warehouse that covers the most cart keys; break ties by proximity
  const countCovered = (warehouseId: string) => {
    const set = warehouseProductSets[warehouseId] ?? new Set()
    return distinctCartKeys.filter((k) => set.has(k)).length
  }

  let bestWarehouse = warehouses[0]
  let bestCount = countCovered(warehouses[0].id)
  let bestScore = proximityScore(bestWarehouse.address_state, deliveryState)

  for (const wh of warehouses.slice(1)) {
    const count = countCovered(wh.id)
    const score = proximityScore(wh.address_state, deliveryState)
    const isBetter =
      count > bestCount ||
      (count === bestCount && score < bestScore)
    if (isBetter) {
      bestWarehouse = wh
      bestCount = count
      bestScore = score
    }
  }

  const selectedSet = warehouseProductSets[bestWarehouse.id] ?? new Set()
  // missingProductIds: product IDs where at least one cart size is not covered
  const missingProductIds = distinctProductIds.filter((pid) => {
    const keysForProduct = distinctCartKeys.filter((k) => k.startsWith(`${pid}:`))
    return keysForProduct.some((k) => !selectedSet.has(k))
  })

  return {
    warehouse: bestWarehouse,
    isPartialFulfillment: true,
    missingProductIds,
  }
}
