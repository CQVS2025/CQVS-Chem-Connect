// Supplier-managed freight strategy.
//
// For a cart whose products map to a supplier-managed warehouse, this
// module computes the freight quote from the supplier's distance-based
// rate sheet. It returns the same shape MacShip does so the rest of
// lib/orders/calculate.ts is unchanged.
//
// The math is per cart line:
//
//   per_litre              freight = rate × litres × qty
//   flat_per_consignment   freight = rate (single line drives the whole
//                                    consignment; per-bracket lookup)
//   per_kg / per_pallet    freight = rate × units × qty
//   per_zone               rate sheets keyed by zone instead of bracket
//                          (Phase 2 — placeholder for future suppliers)
//
// The freight number is the SUM of all per-line freight numbers in
// the cart for supplier-managed lines.

import type { SupabaseClient } from "@supabase/supabase-js"
import { getRoadDistanceKm, roundUpToBracketKm } from "./distance"
import type {
  CartLine,
  FulfillmentResult,
  FulfillmentWarehouse,
  RateSheetUnitType,
  SupplierFreightLineBreakdown,
} from "./types"

interface RateSheet {
  id: string
  warehouse_id: string
  name: string
  unit_type: RateSheetUnitType
  origin_postcode: string | null
  is_active: boolean
  min_charge: number | null
  out_of_range_behavior: "last_bracket" | "block" | "quote_on_application"
}

interface RateBracket {
  rate_sheet_id: string
  distance_from_km: number
  distance_to_km: number
  rate: number
}

interface PackagingSize {
  id: string
  volume_litres: number | null
}

interface ProductFreightMap {
  product_id: string
  packaging_size_id: string | null
  rate_sheet_id: string
}

export interface SupplierStrategyArgs {
  supabase: SupabaseClient
  warehouse: FulfillmentWarehouse
  cartLines: CartLine[]
  destinationPostcode: string
}

/** Pick the most specific rate-sheet mapping for a cart line:
 *  prefer (product_id + packaging_size_id) over (product_id + null). */
function findMapping(
  maps: ProductFreightMap[],
  product_id: string,
  packaging_size_id: string | null,
): ProductFreightMap | undefined {
  return (
    maps.find(
      (m) =>
        m.product_id === product_id &&
        m.packaging_size_id === packaging_size_id,
    ) ??
    maps.find(
      (m) => m.product_id === product_id && m.packaging_size_id === null,
    )
  )
}

function pickBracket(
  brackets: RateBracket[],
  rateSheetId: string,
  km: number,
  outOfRangeBehavior: RateSheet["out_of_range_behavior"],
): RateBracket | { outOfRange: true } | null {
  const sheetBrackets = brackets
    .filter((b) => b.rate_sheet_id === rateSheetId)
    .sort((a, b) => a.distance_from_km - b.distance_from_km)

  if (sheetBrackets.length === 0) return null

  const bracket = sheetBrackets.find(
    (b) => km > b.distance_from_km - 1 && km <= b.distance_to_km,
  )
  if (bracket) return bracket

  // km is past the last bracket — fall back per sheet config.
  const last = sheetBrackets[sheetBrackets.length - 1]
  if (km > last.distance_to_km) {
    if (outOfRangeBehavior === "last_bracket") return last
    return { outOfRange: true }
  }

  // km is below first bracket (rare — bracket starts at 1+) — use first.
  return sheetBrackets[0]
}

export async function quoteSupplierManagedFreight(
  args: SupplierStrategyArgs,
): Promise<FulfillmentResult> {
  const { supabase, warehouse, cartLines, destinationPostcode } = args

  const baseResult = (
    overrides: Partial<FulfillmentResult> = {},
  ): FulfillmentResult => ({
    strategy: "supplier_managed",
    warehouse,
    freightAmount: 0,
    isPartialFulfillment: false,
    missingProductIds: [],
    supplierFreightBreakdown: [],
    ...overrides,
  })

  if (!destinationPostcode) {
    return baseResult({
      blocker: {
        code: "missing_destination",
        message: "Delivery postcode is required to quote supplier freight.",
      },
    })
  }

  const productIds = [...new Set(cartLines.map((l) => l.product_id))]
  const packagingIds = [
    ...new Set(
      cartLines.map((l) => l.packaging_size_id).filter((x): x is string => !!x),
    ),
  ]

  // Pull the warehouse's rate sheets, brackets, and product mappings in
  // parallel. We over-fetch slightly (all rate sheets for the warehouse)
  // so the post-fetch filtering is in-memory and consistent.
  const [
    { data: maps },
    { data: rateSheets },
    { data: packagingSizes },
  ] = await Promise.all([
    supabase
      .from("product_freight_rate_sheets")
      .select("product_id, packaging_size_id, rate_sheet_id")
      .in("product_id", productIds),
    supabase
      .from("supplier_rate_sheets")
      .select(
        "id, warehouse_id, name, unit_type, origin_postcode, is_active, min_charge, out_of_range_behavior",
      )
      .eq("warehouse_id", warehouse.id)
      .eq("is_active", true),
    packagingIds.length > 0
      ? supabase
          .from("packaging_sizes")
          .select("id, volume_litres")
          .in("id", packagingIds)
      : Promise.resolve({ data: [] as PackagingSize[] }),
  ])

  const mappings = (maps ?? []) as ProductFreightMap[]
  const sheets = (rateSheets ?? []) as RateSheet[]
  const sizes = (packagingSizes ?? []) as PackagingSize[]
  const sizeById = new Map(sizes.map((s) => [s.id, s]))

  const sheetIds = sheets.map((s) => s.id)
  const { data: bracketsData } =
    sheetIds.length > 0
      ? await supabase
          .from("supplier_rate_sheet_brackets")
          .select("rate_sheet_id, distance_from_km, distance_to_km, rate")
          .in("rate_sheet_id", sheetIds)
      : { data: [] as RateBracket[] }
  const brackets = (bracketsData ?? []) as RateBracket[]

  // Resolve a single origin per sheet (sheet override → warehouse postcode).
  const breakdown: SupplierFreightLineBreakdown[] = []
  let total = 0

  for (const line of cartLines) {
    const map = findMapping(mappings, line.product_id, line.packaging_size_id ?? null)
    if (!map) {
      return baseResult({
        blocker: {
          code: "no_rate_sheet",
          message: `No freight rate sheet is mapped for product ${line.product_id}.`,
        },
      })
    }

    const sheet = sheets.find((s) => s.id === map.rate_sheet_id)
    if (!sheet) {
      return baseResult({
        blocker: {
          code: "no_rate_sheet",
          message: `Rate sheet ${map.rate_sheet_id} is inactive or missing.`,
        },
      })
    }

    const origin = sheet.origin_postcode ?? warehouse.address_postcode
    if (!origin) {
      return baseResult({
        blocker: {
          code: "missing_origin",
          message: `Rate sheet ${sheet.name} has no origin postcode and the warehouse has none either.`,
        },
      })
    }

    const km = await getRoadDistanceKm(origin, destinationPostcode)
    if (km === null) {
      return baseResult({
        blocker: {
          code: "distance_lookup_failed",
          message: `Could not look up the distance from ${origin} to ${destinationPostcode}.`,
        },
      })
    }

    const bracketKm = roundUpToBracketKm(km)
    const bracket = pickBracket(
      brackets,
      sheet.id,
      bracketKm,
      sheet.out_of_range_behavior,
    )
    if (!bracket) {
      return baseResult({
        blocker: {
          code: "no_rate_sheet",
          message: `Rate sheet ${sheet.name} has no distance brackets configured.`,
        },
      })
    }
    if ("outOfRange" in bracket) {
      return baseResult({
        blocker: {
          code: "out_of_range",
          message: `${origin} → ${destinationPostcode} (${Math.round(
            km,
          )}km) is past the maximum distance for ${sheet.name}.`,
        },
      })
    }

    // Resolve the per-unit-type freight number for this line.
    let units = line.quantity
    let lineFreight = 0
    switch (sheet.unit_type) {
      case "per_litre": {
        const litres = line.packaging_size_id
          ? sizeById.get(line.packaging_size_id)?.volume_litres ?? 0
          : 0
        units = litres * line.quantity
        lineFreight = bracket.rate * units
        break
      }
      case "flat_per_consignment": {
        // The line contributes a single per-bracket rate, multiplied by
        // the number of consignments (i.e. the number of units shipped).
        units = line.quantity
        lineFreight = bracket.rate * units
        break
      }
      case "per_kg":
      case "per_pallet": {
        units = line.quantity
        lineFreight = bracket.rate * units
        break
      }
      case "per_zone": {
        // Phase 2 placeholder. For now treat zone rate sheets like
        // flat_per_consignment until zone metadata is layered in.
        units = line.quantity
        lineFreight = bracket.rate * units
        break
      }
    }

    if (sheet.min_charge !== null && lineFreight < sheet.min_charge) {
      lineFreight = sheet.min_charge
    }

    breakdown.push({
      product_id: line.product_id,
      packaging_size_id: line.packaging_size_id ?? null,
      rate_sheet_id: sheet.id,
      rate_sheet_name: sheet.name,
      unit_type: sheet.unit_type,
      distance_km: Math.round(km),
      bracket_from_km: bracket.distance_from_km,
      bracket_to_km: bracket.distance_to_km,
      rate: bracket.rate,
      units,
      freight: Math.round(lineFreight * 100) / 100,
    })

    total += lineFreight
  }

  return baseResult({
    freightAmount: Math.round(total * 100) / 100,
    supplierFreightBreakdown: breakdown,
  })
}
