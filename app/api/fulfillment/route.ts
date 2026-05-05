// POST /api/fulfillment
//
// Public-facing endpoint that classifies a cart and returns the freight
// quote (supplier-managed) or a "use macship" indicator. Also enforces
// the Phase 1 mixed-cart blocker (component 17), logging blocks to the
// mixed_cart_block_events table for sizing Phase 2.
//
// Request body:
//   {
//     items: [{ product_id, packaging_size_id?, quantity }, …],
//     delivery_postcode: string,
//   }
//
// Response on supplier-managed cart:
//   { ok: true, strategy: "supplier_managed", freight: 145.50,
//     warehouse: {...}, breakdown: [...] }
//
// On mixed cart:
//   { ok: false, code: "mixed_cart", message: "...", offending_products: {...} }

import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { routeFreightQuote } from "@/lib/fulfillment/router"

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const body = await request.json()

  const items = Array.isArray(body.items) ? body.items : []
  const postcode = String(body.delivery_postcode ?? "")

  if (items.length === 0 || !postcode) {
    return NextResponse.json(
      { error: "items and delivery_postcode are required" },
      { status: 400 },
    )
  }

  const cartLines = items.map(
    (i: {
      product_id: string
      packaging_size_id?: string | null
      quantity: number
    }) => ({
      product_id: i.product_id,
      packaging_size_id: i.packaging_size_id ?? null,
      quantity: i.quantity,
    }),
  )

  const result = await routeFreightQuote({
    supabase,
    cartLines,
    destinationPostcode: postcode,
  })

  if (!result.ok && result.code === "mixed_cart") {
    // Log the block so Phase 2 prioritisation has data behind it (M11).
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const macId = result.offendingProducts?.macship
      const supId = result.offendingProducts?.supplier

      const { data: products } = await createServiceRoleClient()
        .from("products")
        .select("id, name")
        .in("id", [macId, supId].filter(Boolean) as string[])
      const nameOf = (id: string | undefined) =>
        products?.find((p: { id: string; name: string }) => p.id === id)?.name ??
        null

      await createServiceRoleClient().from("mixed_cart_block_events").insert({
        user_id: user?.id ?? null,
        macship_product_id: macId ?? null,
        supplier_product_id: supId ?? null,
        macship_product_name: nameOf(macId),
        supplier_product_name: nameOf(supId),
      })
    } catch (err) {
      console.error("[mixed cart] failed to log event:", err)
    }

    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        offending_products: result.offendingProducts,
      },
      { status: 409 },
    )
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status: 400 },
    )
  }

  const r = result.result
  return NextResponse.json({
    ok: true,
    strategy: r.strategy,
    warehouse: r.warehouse
      ? {
          id: r.warehouse.id,
          name: r.warehouse.name,
          state: r.warehouse.address_state,
          postcode: r.warehouse.address_postcode,
          is_supplier_managed: r.warehouse.is_supplier_managed,
        }
      : null,
    freight: r.freightAmount,
    blocker: r.blocker ?? null,
    breakdown: r.supplierFreightBreakdown ?? null,
    is_partial_fulfillment: r.isPartialFulfillment,
    missing_product_ids: r.missingProductIds,
  })
}
