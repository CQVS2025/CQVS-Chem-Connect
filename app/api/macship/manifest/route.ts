import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { manifestConsignments, isMacShipConfigured } from "@/lib/macship/client"

// ============================================================
// POST /api/macship/manifest
// Requires admin auth
// ============================================================

export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  try {
    const body = await request.json()
    const { order_id } = body as { order_id: string }

    if (!order_id) {
      return NextResponse.json(
        { error: "order_id is required" },
        { status: 400 },
      )
    }

    // 1. Fetch order with macship fields
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, macship_consignment_id, macship_dispatched_at, macship_manifest_id")
      .eq("id", order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message ?? "Order not found" },
        { status: 404 },
      )
    }

    // 2. Validate not already manifested
    if (order.macship_dispatched_at) {
      return NextResponse.json(
        {
          error: "Order has already been manifested",
          manifested_at: order.macship_dispatched_at,
          manifest_id: order.macship_manifest_id,
        },
        { status: 409 },
      )
    }

    // 3. Call Machship manifest if a real consignment exists.
    // Otherwise (dev mock mode / Machship setup pending), mark as dispatched
    // locally only - admin will need to book with the carrier manually.
    const now = new Date().toISOString()
    let manifestId: string | null = null

    if (order.macship_consignment_id && isMacShipConfigured()) {
      try {
        const manifestResult = await manifestConsignments([order.macship_consignment_id])
        manifestId = manifestResult.id ? String(manifestResult.id) : null
      } catch (err) {
        console.error("[Machship manifest] API call failed:", err)
        return NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Machship manifest call failed",
          },
          { status: 502 },
        )
      }
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        macship_manifest_id: manifestId,
        macship_dispatched_at: now,
      })
      .eq("id", order_id)

    if (updateError) {
      console.error("[Machship manifest] Failed to update order:", updateError.message)
      return NextResponse.json(
        { error: "Manifest succeeded but failed to update order record" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      manifest_id: manifestId,
      dispatched_at: now,
      order_number: order.order_number,
    })
  } catch (err) {
    console.error("[MacShip manifest] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
