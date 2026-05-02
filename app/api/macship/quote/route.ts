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
  buildParcelCart,
} from "@/lib/macship/pallet-consolidation"
import {
  runWithIntegrationContext,
  updateIntegrationContext,
  logIntegrationEvent,
} from "@/lib/integration-log"
import { randomUUID } from "node:crypto"

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
  // Each quote attempt gets its own correlation_id so every Machship
  // call in this scope (warehouse select, getRoutes parcel-first, getRoutes
  // pallet fallback) is linkable in /admin/integration-logs.
  return runWithIntegrationContext({ correlationId: randomUUID() }, () =>
    handleQuote(request),
  )
}

async function handleQuote(request: NextRequest) {
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

    // Tag every Machship call in this scope with the customer + cart
    // context so admin can answer "why didn't this customer's quote work"
    // by filtering /admin/integration-logs by user_id.
    const {
      data: { user: quoteUser },
    } = await supabase.auth.getUser()
    if (quoteUser?.id) {
      updateIntegrationContext({ userId: quoteUser.id })
    }
    updateIntegrationContext({
      metadata: {
        delivery_postcode,
        delivery_state,
        delivery_city,
        items_count: cart_items.length,
        forklift_available,
      },
    })

    // 1. Select best warehouse
    let selectedWarehouse: Awaited<ReturnType<typeof selectWarehouse>> | null = null
    try {
      selectedWarehouse = await selectWarehouse(cart_items, delivery_postcode, supabase)
    } catch (err) {
      console.error("[MacShip quote] selectWarehouse failed:", err)
      await logIntegrationEvent({
        integration: "macship",
        action: "quote.warehouse_select_failed",
        status: "error",
        errorCategory: "business",
        errorCode: "NO_WAREHOUSE",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
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

    // 3. Build Machship items. Two candidate shapes:
    //    - parcelItems: send as N Aramex cartons (only if cart is parcel-
    //      eligible — small containers under 30 kg each). Can be null.
    //    - palletItems: consolidate onto pallets per "Option B" rules.
    //      Always non-empty.
    // We try parcel first and fall back to pallet only if parcel returns
    // zero routes (Option 2 — approved by Jonny Harper, April 2026). This
    // fixes the prod bug where qty 2+ of 20L drums became "not serviceable"
    // on lanes that pallet carriers didn't cover but Aramex did.
    const consolidationInput = cart_items.map((item) => {
      const product = productMap.get(item.product_id)
      return {
        product_name: product?.name ?? item.packaging_size_name,
        packaging_size_name: item.packaging_size_name,
        packaging_size_id: item.packaging_size_id,
        quantity: item.quantity,
      }
    })
    const parcelItems = buildParcelCart(consolidationInput, capacityMap)
    const palletItems: MachshipItem[] = buildConsolidatedCart(
      consolidationInput,
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
    const baseRouteRequest = {
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
      // Question ID 7 = "Hydraulic Tailgate required" in Machship.
      // When customer has no forklift, tailgate delivery is needed which
      // adds a surcharge (e.g. Hi Trans Tailgate Surcharge ~$180).
      questionIds: forklift_available === false ? [7] : [],
    }

    // Parcel-first attempt (only when cart is parcel-eligible).
    let routesResponse: Awaited<ReturnType<typeof getRoutes>> | null = null
    let itemShape: "parcel" | "pallet" = "pallet"
    if (parcelItems) {
      const parcelRequest = { ...baseRouteRequest, items: parcelItems }
      console.log(
        "[Machship quote] parcel-first request:",
        JSON.stringify(parcelRequest),
      )
      routesResponse = await getRoutes(parcelRequest)
      console.log(
        "[Machship quote] parcel-first response:",
        JSON.stringify({
          id: routesResponse.id,
          routesCount: routesResponse.routes?.length ?? 0,
          firstRoute: routesResponse.routes?.[0],
        }),
      )
      if (routesResponse.routes && routesResponse.routes.length > 0) {
        itemShape = "parcel"
      } else {
        routesResponse = null // force fallback
      }
    }

    // Pallet fallback — runs when parcel wasn't eligible or parcel carriers
    // returned no routes for this lane.
    if (!routesResponse) {
      const palletRequest = { ...baseRouteRequest, items: palletItems }
      console.log(
        "[Machship quote] pallet request:",
        JSON.stringify(palletRequest),
      )
      routesResponse = await getRoutes(palletRequest)
      console.log(
        "[Machship quote] pallet response:",
        JSON.stringify({
          id: routesResponse.id,
          routesCount: routesResponse.routes?.length ?? 0,
          firstRoute: routesResponse.routes?.[0],
        }),
      )
      itemShape = "pallet"
    }

    if (!routesResponse.routes || routesResponse.routes.length === 0) {
      // The customer just got "not serviceable" with a generic message.
      // Without this row admin had no way to find out *why* — the prod
      // incident (carrier not configured on Machship account) hit here
      // and was invisible. We capture the request + the request_id so
      // anyone can paste it into Machship support.
      await logIntegrationEvent({
        integration: "macship",
        action: "quote.zero_routes",
        status: "error",
        errorCategory: "carrier_config",
        errorCode: "QUOTE_ZERO_ROUTES",
        errorMessage:
          "Quote returned zero routes after both parcel and pallet attempts. " +
          "Likely causes: (1) MachShip account has no carriers configured for this lane " +
          "(contact MachShip support), (2) item dimensions exceed all available carrier limits, " +
          "(3) destination postcode/suburb mismatch.",
        endpoint: "/apiv2/routes/returnroutes",
        metadata: {
          warehouse_id: selectedWarehouse.warehouse.id,
          warehouse_name: selectedWarehouse.warehouse.name,
          warehouse_postcode: selectedWarehouse.warehouse.address_postcode,
          delivery_postcode,
          delivery_state,
          delivery_city,
          item_shape_attempted: itemShape,
          parcel_attempted: parcelItems !== null,
          pallet_attempted: true,
          machship_request_id: routesResponse.id,
        },
      })
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

    // Successful quote breadcrumb — pairs with the finalize/consignment
    // rows downstream so admin can reconstruct what was quoted vs booked.
    await logIntegrationEvent({
      integration: "macship",
      action: "quote.success",
      status: "success",
      metadata: {
        carrier_id: bestRoute.carrier.id,
        carrier_name: bestRoute.carrier.displayName ?? bestRoute.carrier.name,
        service_name: bestRoute.carrierService?.name ?? null,
        quote_shape: itemShape,
        is_dg: isDG,
        total: bestRoute.consignmentTotal.totalSellPrice,
        machship_request_id: routesResponse.id,
      },
    })

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
      // Which shape ultimately succeeded with MacShip. Useful for dev
      // diagnostics ("did the parcel-first path win?") without exposing
      // internals to the customer.
      quote_shape: itemShape,
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
    // The xeroRequest/machshipRequest wrappers already logged the
    // outbound HTTP failure (with full request/response). This event row
    // adds the *quote-level* outcome so admin sees a single "quote failed"
    // entry alongside the lower-level call rows in the same correlation.
    await logIntegrationEvent({
      integration: "macship",
      action: "quote.unhandled_error",
      status: "error",
      errorCategory: "unknown",
      errorCode: "QUOTE_HANDLER_FAILED",
      errorMessage: err instanceof Error ? err.message : String(err),
    })
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
