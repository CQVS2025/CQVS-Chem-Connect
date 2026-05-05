// Supplier can update or withdraw their own pending claim.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const { data: claim } = await supabase
    .from("freight_variance_claims")
    .select("id, warehouse_id, status, claimed_by")
    .eq("id", id)
    .single()
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (
    !sctx.isAdmin &&
    !sctx.canUpdateWarehouseIds.includes(claim.warehouse_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!sctx.isAdmin && claim.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending claims can be edited by suppliers." },
      { status: 400 },
    )
  }

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if ("claimed_amount" in body) allowed.claimed_amount = Number(body.claimed_amount)
  if ("notification_evidence" in body)
    allowed.notification_evidence = body.notification_evidence ?? null
  if ("notified_at" in body) allowed.notified_at = body.notified_at ?? null

  const { error } = await supabase
    .from("freight_variance_claims")
    .update(allowed)
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const { data: claim } = await supabase
    .from("freight_variance_claims")
    .select("warehouse_id, status")
    .eq("id", id)
    .single()
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (
    !sctx.isAdmin &&
    !sctx.canUpdateWarehouseIds.includes(claim.warehouse_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!sctx.isAdmin && claim.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending claims can be withdrawn." },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from("freight_variance_claims")
    .delete()
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
