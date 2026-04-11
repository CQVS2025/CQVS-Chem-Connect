import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  isMacShipConfigured,
  updateConsignmentPickupDate,
} from "@/lib/macship/client"
import { getOrderPickupDate } from "@/lib/macship/lead-time"

// ============================================================
// POST /api/macship/sync-lead-times
// Requires admin auth
// Called when admin saves a lead time change
// ============================================================

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const body = await request.json()
    const { scope, warehouse_id, product_id } = body as {
      scope: "global" | "warehouse" | "product_warehouse"
      warehouse_id?: string
      product_id?: string
    }

    if (!scope || !["global", "warehouse", "product_warehouse"].includes(scope)) {
      return NextResponse.json(
        { error: "scope must be 'global', 'warehouse', or 'product_warehouse'" },
        { status: 400 },
      )
    }
    if (scope === "warehouse" && !warehouse_id) {
      return NextResponse.json(
        { error: "warehouse_id is required for warehouse scope" },
        { status: 400 },
      )
    }
    if (scope === "product_warehouse" && (!warehouse_id || !product_id)) {
      return NextResponse.json(
        { error: "warehouse_id and product_id are required for product_warehouse scope" },
        { status: 400 },
      )
    }

    // Use service role to read all orders regardless of RLS
    const serviceSupabase = createServiceRoleClient()

    // 1. Find affected pending orders.
    // We process any order that has a pickup date but hasn't been dispatched —
    // this includes orders without a real Machship consignment (dev mock mode),
    // so the recalculated pickup date still gets written to the order record.
    let ordersQuery = serviceSupabase
      .from("orders")
      .select("id, order_number, macship_consignment_id, warehouse_id, warehouses(address_state)")
      .not("macship_pickup_date", "is", null)
      .is("macship_dispatched_at", null)

    if (scope === "warehouse" && warehouse_id) {
      ordersQuery = ordersQuery.eq("warehouse_id", warehouse_id)
    }

    const { data: ordersRaw, error: ordersError } = await ordersQuery

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 })
    }

    let orders = ordersRaw ?? []

    // For product_warehouse scope, filter further to orders containing the product
    if (scope === "product_warehouse" && product_id && orders.length > 0) {
      const orderIds = orders.map((o) => o.id)
      const { data: matchingItems } = await serviceSupabase
        .from("order_items")
        .select("order_id")
        .eq("product_id", product_id)
        .in("order_id", orderIds)

      const matchingOrderIds = new Set((matchingItems ?? []).map((i) => i.order_id))
      orders = orders.filter((o) => matchingOrderIds.has(o.id))
    }

    const totalAffected = orders.length
    const needsManualReview: string[] = []
    const failed: string[] = []
    let updated = 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 2. For each affected order, recalculate pickup date
    for (const order of orders) {
      try {
        // Get warehouse state from joined data
        const warehouseRaw = order.warehouses as { address_state: string } | { address_state: string }[] | null
        const warehouseObj = Array.isArray(warehouseRaw) ? warehouseRaw[0] : warehouseRaw
        const warehouseState = warehouseObj?.address_state ?? "VIC"
        const warehouseIdForOrder = order.warehouse_id as string | null

        if (!warehouseIdForOrder) {
          needsManualReview.push(order.id)
          continue
        }

        // Get order items for this order
        const { data: orderItemsData } = await serviceSupabase
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", order.id)

        const items = (orderItemsData ?? []).map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        }))

        // Recalculate pickup date
        const pickupResult = await getOrderPickupDate(
          items,
          warehouseIdForOrder,
          warehouseState,
          serviceSupabase,
        )

        const newPickupDate = pickupResult.pickupDate
        const pickupDateObj = new Date(newPickupDate)
        pickupDateObj.setHours(0, 0, 0, 0)

        // If new pickup date is in the past, flag for manual review
        if (pickupDateObj < today) {
          needsManualReview.push(order.id)
          continue
        }

        // Update MacShip consignment if configured
        if (isMacShipConfigured() && order.macship_consignment_id) {
          const macshipSuccess = await updateConsignmentPickupDate(
            order.macship_consignment_id,
            newPickupDate,
          )

          if (!macshipSuccess) {
            // Record the failure
            await serviceSupabase.from("macship_failed_updates").insert({
              order_id: order.id,
              reason: `Machship updateConsignmentPickupDate failed for consignment ${order.macship_consignment_id} (new pickup ${newPickupDate})`,
            })

            failed.push(order.id)
            continue
          }
        }

        // Update order record with new pickup date
        await serviceSupabase
          .from("orders")
          .update({
            macship_pickup_date: newPickupDate,
            macship_lead_time_fallback: pickupResult.usedFallback,
          })
          .eq("id", order.id)

        updated++
      } catch (orderErr) {
        console.error(`[MacShip sync-lead-times] Error processing order ${order.id}:`, orderErr)
        failed.push(order.id)
      }
    }

    return NextResponse.json({
      total_affected: totalAffected,
      updated,
      needs_manual_review: needsManualReview,
      failed,
    })
  } catch (err) {
    console.error("[MacShip sync-lead-times] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
