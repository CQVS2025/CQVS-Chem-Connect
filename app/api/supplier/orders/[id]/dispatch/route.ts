// PATCH /api/supplier/orders/[id]/dispatch
//
// The supplier sets / updates dispatch_date, estimated_delivery,
// dispatch_notes, tracking_url, dispatch origin postcode, and order
// status. Side effects:
//   - Buyer notification on date set/change                (component 13)
//   - Audit log entry per changed field                    (plan §3.10)
//   - Variance recalc on transition to in_transit          (component 16)
//   - Persist supplier_freight_cost from the recalc        (component 15)

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"
import { sendBuyerSupplierUpdateEmail } from "@/lib/fulfillment/supplier-emails"

const ALLOWED_STATUSES = new Set([
  "received",
  "processing",
  "in_transit",
  "delivered",
])

type AuditField =
  | "supplier_dispatch_date"
  | "estimated_delivery"
  | "supplier_dispatch_notes"
  | "supplier_tracking_url"
  | "supplier_origin_postcode"
  | "status"
  | "supplier_freight_cost"
  | "supplier_variance"

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const { data: existing } = await supabase
    .from("orders")
    .select(
      `id, warehouse_id, status, supplier_dispatch_date, estimated_delivery,
       supplier_dispatch_notes, supplier_tracking_url, supplier_origin_postcode,
       supplier_freight_cost, shipping, delivery_address_postcode`,
    )
    .eq("id", id)
    .single()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (
    !sctx.isAdmin &&
    !sctx.canUpdateWarehouseIds.includes(existing.warehouse_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()

  // --- Build update + audit-trail diff -----------------------------------
  const updates: Record<string, unknown> = {}
  const audit: Array<{ field: AuditField; oldValue: unknown; newValue: unknown }> = []

  const candidates: Array<{ key: AuditField; current: unknown }> = [
    { key: "supplier_dispatch_date", current: existing.supplier_dispatch_date },
    { key: "estimated_delivery", current: existing.estimated_delivery },
    { key: "supplier_dispatch_notes", current: existing.supplier_dispatch_notes },
    { key: "supplier_tracking_url", current: existing.supplier_tracking_url },
    { key: "supplier_origin_postcode", current: existing.supplier_origin_postcode },
  ]
  for (const { key, current } of candidates) {
    if (key in body) {
      const incoming = (body as Record<string, unknown>)[key]
      const normalized = incoming === "" ? null : incoming
      if (normalized !== current) {
        updates[key] = normalized
        audit.push({ field: key, oldValue: current, newValue: normalized })
      }
    }
  }

  if ("status" in body) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    if (body.status !== existing.status) {
      updates.status = body.status
      audit.push({
        field: "status",
        oldValue: existing.status,
        newValue: body.status,
      })
    }
  }

  // Resetting the SLA flag once an ETA exists.
  if ("estimated_delivery" in updates && updates.estimated_delivery) {
    updates.supplier_sla_breached = false
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noChange: true })
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    )
  }

  // --- Audit log (plan §3.10) -------------------------------------------
  if (audit.length > 0) {
    await supabase.from("order_supplier_audit_log").insert(
      audit.map((a) => ({
        order_id: id,
        actor_id: sctx.user.id,
        field: a.field,
        old_value: a.oldValue === null || a.oldValue === undefined ? null : String(a.oldValue),
        new_value: a.newValue === null || a.newValue === undefined ? null : String(a.newValue),
      })),
    )
  }

  // --- Buyer notifications on date set/change (component 13) ------------
  const dispatchChanged = audit.some((a) => a.field === "supplier_dispatch_date")
  const etaChanged = audit.some((a) => a.field === "estimated_delivery")
  const trackingChanged = audit.some((a) => a.field === "supplier_tracking_url")

  if (dispatchChanged) {
    sendBuyerSupplierUpdateEmail({
      supabase,
      orderId: id,
      changedField: "dispatch_date",
      value: (updates.supplier_dispatch_date as string | null) ?? null,
    }).catch((err) => console.error("[supplier dispatch] buyer email:", err))
  }
  if (etaChanged) {
    sendBuyerSupplierUpdateEmail({
      supabase,
      orderId: id,
      changedField: "estimated_delivery",
      value: (updates.estimated_delivery as string | null) ?? null,
    }).catch((err) => console.error("[supplier ETA] buyer email:", err))
  }
  if (trackingChanged) {
    sendBuyerSupplierUpdateEmail({
      supabase,
      orderId: id,
      changedField: "tracking_url",
      value: (updates.supplier_tracking_url as string | null) ?? null,
    }).catch((err) => console.error("[supplier tracking] buyer email:", err))
  }

  // --- Lock freight on in_transit transition (contract model) ----------
  // Per supplier agreement, freight is locked at quote time. The supplier
  // is paid exactly orders.shipping unless they raised a pre-dispatch
  // variance claim that admin approved. No auto-recalc, no auto-flag.
  if (
    body.status === "in_transit" &&
    existing.status !== "in_transit"
  ) {
    try {
      const { data: approvedClaim } = await supabase
        .from("freight_variance_claims")
        .select("id, claimed_amount")
        .eq("order_id", id)
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const lockedFreight =
        approvedClaim && approvedClaim.claimed_amount !== null
          ? Number(approvedClaim.claimed_amount)
          : Number(existing.shipping ?? 0)

      const { error: lockError } = await supabase
        .from("orders")
        .update({
          supplier_freight_cost: lockedFreight,
          supplier_variance_flagged: false,
          supplier_variance_amount: 0,
        })
        .eq("id", id)

      if (!lockError) {
        await supabase.from("order_supplier_audit_log").insert({
          order_id: id,
          actor_id: sctx.user.id,
          field: "supplier_freight_cost",
          old_value: existing.supplier_freight_cost?.toString() ?? null,
          new_value: lockedFreight.toString(),
        })
      }
    } catch (err) {
      console.error("[supplier dispatch] freight lock failed:", err)
    }
  }

  return NextResponse.json(updated)
}
