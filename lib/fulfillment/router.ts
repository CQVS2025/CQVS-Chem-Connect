// Fulfillment router.
//
// Replaces the direct call to lib/macship/warehouse-selector — given a
// cart and a delivery postcode, this:
//
//   1. Classifies each cart line as MacShip-fulfilled or supplier-managed
//      (by looking at which warehouse(s) carry the product).
//   2. Phase 1: blocks mixed carts (component 17) and logs the event.
//   3. Picks the right strategy and returns a unified FulfillmentResult.
//
// The legacy MacShip path (selectWarehouse) is preserved verbatim for
// MacShip-only carts. Supplier-managed carts go through the supplier
// strategy and skip the MacShip quote call entirely.

import type { SupabaseClient } from "@supabase/supabase-js"
import { selectWarehouse } from "@/lib/macship/warehouse-selector"
import type {
  CartLine,
  FulfillmentResult,
  FulfillmentWarehouse,
} from "./types"
import { quoteSupplierManagedFreight } from "./supplier-strategy"

export interface ClassifiedLine extends CartLine {
  warehouse_id: string | null
  is_supplier_managed: boolean
}

export interface ClassifyResult {
  lines: ClassifiedLine[]
  hasMacship: boolean
  hasSupplierManaged: boolean
  /** When supplier-managed lines exist, this is the supplier warehouse
   *  they all map to. Phase 1 enforces a single supplier per cart. */
  supplierWarehouseId: string | null
}

/**
 * Resolve which warehouse each cart line will fulfil from, by joining
 * product_warehouses → warehouses.is_supplier_managed.
 *
 * For products mapped to multiple warehouses, prefers a supplier-managed
 * warehouse if any (the supplier-managed flag is the discriminator,
 * regardless of state proximity — supplier products can only be
 * fulfilled by their supplier).
 */
export async function classifyCart(
  supabase: SupabaseClient,
  cartLines: CartLine[],
): Promise<ClassifyResult> {
  if (cartLines.length === 0) {
    return {
      lines: [],
      hasMacship: false,
      hasSupplierManaged: false,
      supplierWarehouseId: null,
    }
  }

  const productIds = [...new Set(cartLines.map((l) => l.product_id))]
  const { data: mappings } = await supabase
    .from("product_warehouses")
    .select("product_id, packaging_size_id, warehouse_id")
    .in("product_id", productIds)

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, is_supplier_managed, is_active")
    .eq("is_active", true)

  const supplierWarehouseIds = new Set(
    (warehouses ?? [])
      .filter((w: { is_supplier_managed: boolean }) => w.is_supplier_managed)
      .map((w: { id: string }) => w.id),
  )

  const classified: ClassifiedLine[] = cartLines.map((line) => {
    const candidates = (mappings ?? []).filter(
      (m: { product_id: string; packaging_size_id: string | null }) =>
        m.product_id === line.product_id &&
        (m.packaging_size_id === null ||
          m.packaging_size_id === line.packaging_size_id),
    )

    const supplierMatch = candidates.find(
      (m: { warehouse_id: string }) => supplierWarehouseIds.has(m.warehouse_id),
    )
    const macMatch = candidates.find(
      (m: { warehouse_id: string }) => !supplierWarehouseIds.has(m.warehouse_id),
    )
    const chosen = supplierMatch ?? macMatch

    return {
      ...line,
      warehouse_id: chosen?.warehouse_id ?? null,
      is_supplier_managed: chosen
        ? supplierWarehouseIds.has(chosen.warehouse_id)
        : false,
    }
  })

  const hasMacship = classified.some((l) => !l.is_supplier_managed && l.warehouse_id)
  const supplierWarehouseId =
    classified.find((l) => l.is_supplier_managed)?.warehouse_id ?? null
  const hasSupplierManaged = supplierWarehouseId !== null

  return {
    lines: classified,
    hasMacship,
    hasSupplierManaged,
    supplierWarehouseId,
  }
}

export type RouteFreightResult =
  | { ok: true; result: FulfillmentResult }
  | {
      ok: false
      code: "mixed_cart" | "no_supplier_warehouse"
      message: string
      offendingProducts?: { macship?: string; supplier?: string }
    }

export interface RouteFreightArgs {
  supabase: SupabaseClient
  cartLines: CartLine[]
  destinationPostcode: string
  /** When the caller (checkout) wants the legacy MacShip warehouse
   *  selection (state-based proximity), pass true. Cart pages that just
   *  need to pre-flight the mixed-cart blocker can pass false. */
  resolveMacshipWarehouse?: boolean
}

export async function routeFreightQuote(
  args: RouteFreightArgs,
): Promise<RouteFreightResult> {
  const { supabase, cartLines, destinationPostcode } = args
  const classify = await classifyCart(supabase, cartLines)

  // Phase 1 mixed-cart blocker (component 17)
  if (classify.hasMacship && classify.hasSupplierManaged) {
    const macshipLine = classify.lines.find(
      (l) => !l.is_supplier_managed && l.warehouse_id,
    )
    const supplierLine = classify.lines.find((l) => l.is_supplier_managed)
    return {
      ok: false,
      code: "mixed_cart",
      message:
        "This cart mixes a supplier-managed product with a regular MacShip product. Please split into two orders.",
      offendingProducts: {
        macship: macshipLine?.product_id,
        supplier: supplierLine?.product_id,
      },
    }
  }

  if (classify.hasSupplierManaged && classify.supplierWarehouseId) {
    const { data: w } = await supabase
      .from("warehouses")
      .select(
        "id, name, address_street, address_city, address_state, address_postcode, contact_name, contact_email, contact_phone, is_supplier_managed, is_active",
      )
      .eq("id", classify.supplierWarehouseId)
      .single()

    if (!w) {
      return {
        ok: false,
        code: "no_supplier_warehouse",
        message: "Supplier warehouse is inactive.",
      }
    }

    const warehouse: FulfillmentWarehouse = {
      id: w.id,
      name: w.name,
      address_street: w.address_street,
      address_city: w.address_city,
      address_state: w.address_state,
      address_postcode: w.address_postcode,
      contact_name: w.contact_name,
      contact_email: w.contact_email,
      contact_phone: w.contact_phone,
      is_supplier_managed: true,
    }

    const result = await quoteSupplierManagedFreight({
      supabase,
      warehouse,
      cartLines,
      destinationPostcode,
    })
    return { ok: true, result }
  }

  // MacShip-only cart — defer to the legacy selector. The freight number
  // itself is supplied separately by the MacShip quote endpoint, so we
  // return 0 here and the caller continues to use macship_quote_amount.
  const sel = await selectWarehouse(
    cartLines.map((l) => ({
      product_id: l.product_id,
      packaging_size_id: l.packaging_size_id ?? undefined,
    })),
    destinationPostcode,
    supabase,
  )
  return {
    ok: true,
    result: {
      strategy: "macship",
      warehouse: { ...sel.warehouse, is_supplier_managed: false },
      freightAmount: 0,
      isPartialFulfillment: sel.isPartialFulfillment,
      missingProductIds: sel.missingProductIds,
    },
  }
}
