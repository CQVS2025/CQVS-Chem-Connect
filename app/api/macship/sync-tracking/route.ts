import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isMacShipConfigured, getConsignment } from "@/lib/macship/client"

// ============================================================
// GET /api/macship/sync-tracking
// Requires admin auth
// Called periodically to sync tracking status for dispatched orders
// ============================================================

export async function GET(_request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    if (!isMacShipConfigured()) {
      return NextResponse.json({
        synced: 0,
        delivered: 0,
        errors: [],
        message: "MacShip not configured - skipped",
      })
    }

    // Use service role to read all orders regardless of RLS
    const serviceSupabase = createServiceRoleClient()

    // 1. Find dispatched orders that are not yet delivered and have a consignment ID
    const { data: ordersRaw, error: ordersError } = await serviceSupabase
      .from("orders")
      .select("id, order_number, macship_consignment_id, macship_tracking_url, status")
      .not("macship_dispatched_at", "is", null)
      .not("macship_consignment_id", "is", null)
      .neq("status", "delivered")

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    const orders = ordersRaw ?? []
    let synced = 0
    let delivered = 0
    const errors: string[] = []

    // 2. For each order, fetch tracking from Machship
    for (const order of orders) {
      try {
        const tracking = await getConsignment(order.macship_consignment_id!)

        const updates: Record<string, unknown> = {}

        // Build tracking URL from token if we don't already have one stored
        const trackingUrl = tracking.trackingPageAccessToken
          ? `https://mship.io/v2/${tracking.trackingPageAccessToken}`
          : null
        if (trackingUrl && trackingUrl !== order.macship_tracking_url) {
          updates.macship_tracking_url = trackingUrl
        }

        // Status name examples: "Delivered", "InTransit", "Booked", "Pickup", "Exception"
        const statusName = tracking.status?.name?.toLowerCase() ?? ""
        if (statusName === "delivered") {
          updates.status = "delivered"
          delivered++
        }

        if (Object.keys(updates).length > 0) {
          await serviceSupabase
            .from("orders")
            .update(updates)
            .eq("id", order.id)
        }

        synced++
      } catch (trackingErr) {
        const errMsg = `Order ${order.order_number} (${order.id}): ${trackingErr instanceof Error ? trackingErr.message : String(trackingErr)}`
        console.error("[Machship sync-tracking] error:", errMsg)
        errors.push(errMsg)
      }
    }

    return NextResponse.json({ synced, delivered, errors })
  } catch (err) {
    console.error("[MacShip sync-tracking] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
