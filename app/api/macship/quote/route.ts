import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  isMacShipConfigured,
  getRoutes,
  type MachshipItem,
} from "@/lib/macship/client"
import { selectWarehouse } from "@/lib/macship/warehouse-selector"
import { getOrderPickupDate } from "@/lib/macship/lead-time"
import {
  buildConsolidatedCart,
  buildCapacityMap,
} from "@/lib/macship/pallet-consolidation"

// ============================================================
// Helpers
// ============================================================

/** Detect whether a product is dangerous goods based on its classification */
function isDgProduct(classification: string | null | undefined): boolean {
  if (!classification) return false
  const c = classification.toLowerCase()
  if (c === "non-dg" || c === "non dg" || c === "none" || c === "") return false
  return true
}

// ============================================================
// POST /api/macship/quote
// No auth required - called from customer checkout
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      delivery_postcode,
      delivery_state,
      delivery_city,
      cart_items,
      forklift_available,
    } = body as {
      delivery_postcode: string
      delivery_state: string
      delivery_city?: string
      cart_items: Array<{
        product_id: string
        packaging_size_id: string
        packaging_size_name: string
        quantity: number
      }>
      forklift_available: boolean
    }

    if (!delivery_postcode || !delivery_state) {
      return NextResponse.json(
        { error: "delivery_postcode and delivery_state are required" },
        { status: 400 },
      )
    }
    if (!delivery_city || delivery_city.trim() === "") {
      // Machship requires both suburb + postcode - wait for the customer to enter the city
      return NextResponse.json({
        serviceable: false,
        shipping_amount: null,
        carrier_name: null,
        carrier_id: null,
        warehouse_id: null,
        warehouse_name: null,
        estimated_transit_days: null,
        pickup_date: null,
        is_partial_fulfillment: false,
        missing_product_ids: [],
        request_id: null,
        message: "Enter a delivery suburb to get a shipping quote",
      })
    }
    if (!Array.isArray(cart_items) || cart_items.length === 0) {
      return NextResponse.json(
        { error: "cart_items must be a non-empty array" },
        { status: 400 },
      )
    }

    const supabase = await createServerSupabaseClient()

    // 1. Select best warehouse
    let selectedWarehouse: Awaited<ReturnType<typeof selectWarehouse>> | null = null
    try {
      selectedWarehouse = await selectWarehouse(cart_items, delivery_postcode, supabase)
    } catch (err) {
      console.error("[MacShip quote] selectWarehouse failed:", err)
      return NextResponse.json({
        serviceable: false,
        shipping_amount: null,
        carrier_name: null,
        carrier_id: null,
        warehouse_id: null,
        warehouse_name: null,
        estimated_transit_days: null,
        pickup_date: null,
        is_partial_fulfillment: false,
        missing_product_ids: [],
        message: "No active warehouses available",
      })
    }

    // If NO products in the cart are stocked at any warehouse → unserviceable
    const cartProductIds = new Set(cart_items.map((i) => i.product_id))
    const missingAll =
      selectedWarehouse.isPartialFulfillment &&
      selectedWarehouse.missingProductIds.length >= cartProductIds.size
    if (missingAll) {
      return NextResponse.json({
        serviceable: false,
        shipping_amount: null,
        carrier_name: null,
        carrier_id: null,
        warehouse_id: selectedWarehouse.warehouse.id,
        warehouse_name: selectedWarehouse.warehouse.name,
        estimated_transit_days: null,
        pickup_date: null,
        is_partial_fulfillment: true,
        missing_product_ids: selectedWarehouse.missingProductIds,
        message:
          "None of the items in your cart are available at any warehouse - please contact us for a custom quote",
      })
    }

    // 2. Get product details (name + classification)
    const productIds = [...new Set(cart_items.map((i) => i.product_id))]
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, classification")
      .in("id", productIds)

    const productMap = new Map(
      (productsData ?? []).map((p) => [p.id, p]),
    )

    // 2b. Fetch packaging_sizes for the cart so admin-configured pallet
    // capacities take precedence over the hardcoded fallbacks.
    const packagingSizeIds = [
      ...new Set(
        cart_items
          .map((i) => i.packaging_size_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const { data: packagingSizesData } = packagingSizeIds.length > 0
      ? await supabase
          .from("packaging_sizes")
          .select("id, name, units_per_pallet, unit_weight_kg")
          .in("id", packagingSizeIds)
      : { data: [] as Array<{ id: string; name: string; units_per_pallet: number | null; unit_weight_kg: number | null }> }
    const capacityMap = buildCapacityMap(packagingSizesData ?? [])

    // 3. Build Machship items via the whole-cart consolidation helper.
    // This aggregates lines sharing a packaging size onto shared pallets
    // (CQVS' "Option B" pricing rule - approved April 2026).
    const machshipItems: MachshipItem[] = buildConsolidatedCart(
      cart_items.map((item) => {
        const product = productMap.get(item.product_id)
        return {
          product_name: product?.name ?? item.packaging_size_name,
          packaging_size_name: item.packaging_size_name,
          packaging_size_id: item.packaging_size_id,
          quantity: item.quantity,
        }
      }),
      capacityMap,
    )

    const isDG = cart_items.some((i) => isDgProduct(productMap.get(i.product_id)?.classification))

    // 4. Compute pickup date
    const warehouseState = selectedWarehouse.warehouse.address_state
    const pickupResult = await getOrderPickupDate(
      cart_items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      selectedWarehouse.warehouse.id,
      warehouseState,
      supabase,
    )

    // 5. Dev mode - return mock if Machship not configured
    if (!isMacShipConfigured()) {
      return NextResponse.json({
        serviceable: true,
        shipping_amount: 45.0,
        carrier_name: "Test Carrier (Dev Mode)",
        carrier_id: "0",
        warehouse_id: selectedWarehouse.warehouse.id,
        warehouse_name: selectedWarehouse.warehouse.name,
        estimated_transit_days: 3,
        pickup_date: pickupResult.pickupDate,
        is_partial_fulfillment: selectedWarehouse.isPartialFulfillment,
        missing_product_ids: selectedWarehouse.missingProductIds,
        request_id: null,
      })
    }

    // 6. Call Machship returnroutes
    const despatchDateLocal = `${pickupResult.pickupDate}T08:00:00`
    const machshipCompanyId = process.env.MACSHIP_COMPANY_ID
      ? parseInt(process.env.MACSHIP_COMPANY_ID, 10)
      : undefined
    const routeRequest = {
      companyId: machshipCompanyId,
      despatchDateTimeLocal: despatchDateLocal,
      fromLocation: {
        suburb: selectedWarehouse.warehouse.address_city,
        postcode: selectedWarehouse.warehouse.address_postcode,
      },
      fromAddressLine1: selectedWarehouse.warehouse.address_street,
      fromName: selectedWarehouse.warehouse.name,
      toLocation: {
        suburb: delivery_city.trim(),
        postcode: delivery_postcode,
      },
      toName: "Customer",
      items: machshipItems,
      // Question ID 7 = "Hydraulic Tailgate required" in Machship.
      // When customer has no forklift, tailgate delivery is needed which
      // adds a surcharge (e.g. Hi Trans Tailgate Surcharge ~$180).
      questionIds: forklift_available === false ? [7] : [],
    }
    console.log("[Machship quote] request:", JSON.stringify(routeRequest))
    const routesResponse = await getRoutes(routeRequest)
    console.log(
      "[Machship quote] response:",
      JSON.stringify({
        id: routesResponse.id,
        routesCount: routesResponse.routes?.length ?? 0,
        firstRoute: routesResponse.routes?.[0],
      }),
    )

    if (!routesResponse.routes || routesResponse.routes.length === 0) {
      return NextResponse.json({
        serviceable: false,
        shipping_amount: null,
        carrier_name: null,
        carrier_id: null,
        warehouse_id: selectedWarehouse.warehouse.id,
        warehouse_name: selectedWarehouse.warehouse.name,
        estimated_transit_days: null,
        pickup_date: pickupResult.pickupDate,
        is_partial_fulfillment: selectedWarehouse.isPartialFulfillment,
        missing_product_ids: selectedWarehouse.missingProductIds,
        request_id: routesResponse.id,
      })
    }

    // Pick cheapest route by sell price
    const bestRoute = routesResponse.routes.reduce((best, r) =>
      r.consignmentTotal.totalSellPrice < best.consignmentTotal.totalSellPrice ? r : best,
    routesResponse.routes[0])

    // Build surcharge breakdown for transparent pricing
    const allSurcharges = [
      ...(bestRoute.automaticSurcharges ?? []),
      ...(bestRoute.electiveSurcharges ?? []),
    ]
    const tailgateSurcharge = allSurcharges.find(
      (s) => /tailgate/i.test(s.name),
    )
    const otherSurcharges = allSurcharges.filter(
      (s) => !/tailgate/i.test(s.name),
    )

    // ETA from despatch options
    const despatchOption = bestRoute.despatchOptions?.[0]

    return NextResponse.json({
      serviceable: true,
      shipping_amount: bestRoute.consignmentTotal.totalSellPrice,
      carrier_name: bestRoute.carrier.displayName ?? bestRoute.carrier.name,
      carrier_id: String(bestRoute.carrier.id),
      service_name: bestRoute.carrierService?.name ?? null,
      warehouse_id: selectedWarehouse.warehouse.id,
      warehouse_name: selectedWarehouse.warehouse.name,
      pickup_date: pickupResult.pickupDate,
      is_partial_fulfillment: selectedWarehouse.isPartialFulfillment,
      missing_product_ids: selectedWarehouse.missingProductIds,
      request_id: routesResponse.id,
      is_dg: isDG,
      // Transparent pricing breakdown
      pricing: {
        base_rate: bestRoute.consignmentTotal.consignmentRouteSellPrice,
        fuel_levy: bestRoute.consignmentTotal.sellFuelLevyPrice,
        fuel_levy_percent: bestRoute.sellFuelLevyPercentage,
        tax: bestRoute.consignmentTotal.totalTaxSellPrice,
        tax_percent: bestRoute.taxPercentage,
        before_tax: bestRoute.consignmentTotal.totalSellBeforeTax,
        tailgate_applied: Boolean(tailgateSurcharge),
        tailgate_amount: tailgateSurcharge?.sellPrice ?? 0,
        tailgate_name: tailgateSurcharge?.name ?? null,
        other_surcharges: otherSurcharges.map((s) => ({
          name: s.name,
          amount: s.sellPrice,
        })),
        total: bestRoute.consignmentTotal.totalSellPrice,
      },
      // ETA
      eta_date: despatchOption?.etaLocal ?? null,
      eta_business_days: despatchOption?.totalBusinessDays ?? null,
    })
  } catch (err) {
    console.error("[MacShip quote] error:", err)
    return NextResponse.json({
      serviceable: false,
      shipping_amount: null,
      carrier_name: null,
      carrier_id: null,
      warehouse_id: null,
      warehouse_name: null,
      estimated_transit_days: null,
      pickup_date: null,
      is_partial_fulfillment: false,
      missing_product_ids: [],
      request_id: null,
    })
  }
}
