// Supplier endpoint: list own claims, raise a new claim before dispatch.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const orderId = request.nextUrl.searchParams.get("order_id")
  let q = supabase
    .from("freight_variance_claims")
    .select("*, orders!inner(order_number, shipping, status)")
    .order("created_at", { ascending: false })

  if (orderId) q = q.eq("order_id", orderId)
  if (!sctx.isAdmin) q = q.in("warehouse_id", sctx.warehouseIds)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const orderId = body.order_id as string | undefined
  const claimedAmount = Number(body.claimed_amount)
  const notificationEvidence =
    typeof body.notification_evidence === "string"
      ? body.notification_evidence
      : null
  const notifiedAt = body.notified_at ?? null

  if (!orderId || !Number.isFinite(claimedAmount) || claimedAmount <= 0) {
    return NextResponse.json(
      { error: "order_id and a positive claimed_amount are required" },
      { status: 400 },
    )
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, warehouse_id, shipping, status")
    .eq("id", orderId)
    .single()
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (
    !sctx.isAdmin &&
    !sctx.canUpdateWarehouseIds.includes(order.warehouse_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Reject claims raised after dispatch has begun — the contract requires
  // pre-dispatch notification. Admin can still create on behalf if needed
  // (admin path bypasses requireSupplier scoping).
  if (
    !sctx.isAdmin &&
    !["received", "processing"].includes(order.status as string)
  ) {
    return NextResponse.json(
      {
        error:
          "Variance claims must be raised before dispatch (status=received or processing).",
      },
      { status: 400 },
    )
  }

  const { data: existing } = await supabase
    .from("freight_variance_claims")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "pending")
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: "A pending claim already exists for this order." },
      { status: 409 },
    )
  }

  const { data: claim, error: insertError } = await supabase
    .from("freight_variance_claims")
    .insert({
      order_id: orderId,
      warehouse_id: order.warehouse_id,
      claimed_by: sctx.user.id,
      claimed_amount: claimedAmount,
      notification_evidence: notificationEvidence,
      notified_at: notifiedAt,
      status: "pending",
    })
    .select()
    .single()

  if (insertError || !claim) {
    return NextResponse.json(
      { error: insertError?.message ?? "Insert failed" },
      { status: 500 },
    )
  }

  return NextResponse.json(claim, { status: 201 })
}
