// Shared types for the fulfillment subsystem.
//
// The fulfillment router (lib/fulfillment/router.ts) returns one of these
// shapes regardless of which underlying strategy fired (MacShip vs
// supplier-managed). lib/orders/calculate.ts consumes the freight number
// the same way for both paths.

export type FulfillmentStrategy = "macship" | "supplier_managed"

export type RateSheetUnitType =
  | "per_litre"
  | "flat_per_consignment"
  | "per_kg"
  | "per_pallet"
  | "per_zone"

export interface FulfillmentWarehouse {
  id: string
  name: string
  address_street: string
  address_city: string
  address_state: string
  address_postcode: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  is_supplier_managed: boolean
}

export interface SupplierFreightLineBreakdown {
  product_id: string
  packaging_size_id: string | null
  rate_sheet_id: string
  rate_sheet_name: string
  unit_type: RateSheetUnitType
  distance_km: number
  bracket_from_km: number
  bracket_to_km: number
  rate: number
  units: number
  freight: number
}

export interface FulfillmentResult {
  strategy: FulfillmentStrategy
  warehouse: FulfillmentWarehouse | null
  /** Freight quote in AUD. Feeds lib/orders/calculate.ts the same way the
   *  MacShip number does today. */
  freightAmount: number
  /** Detailed per-line breakdown (supplier-managed only). Persisted on
   *  orders.macship_shipping_breakdown? No — we use a separate column when
   *  needed. For Phase 1 we just keep this on the response for UI display. */
  supplierFreightBreakdown?: SupplierFreightLineBreakdown[]
  /** Set when the supplier-managed strategy can't quote (out-of-range,
   *  no rate sheet, etc.). */
  blocker?: {
    code:
      | "no_rate_sheet"
      | "out_of_range"
      | "missing_origin"
      | "missing_destination"
      | "distance_lookup_failed"
    message: string
  }
  /** True if a single warehouse couldn't carry every cart line (legacy
   *  MacShip semantics; carried through for backward compat). */
  isPartialFulfillment: boolean
  missingProductIds: string[]
}

export interface CartLine {
  product_id: string
  packaging_size_id?: string | null
  /** For per-litre rate sheets we need the litres per unit × quantity.
   *  The router resolves this from packaging_sizes.volume_litres × quantity. */
  quantity: number
}
