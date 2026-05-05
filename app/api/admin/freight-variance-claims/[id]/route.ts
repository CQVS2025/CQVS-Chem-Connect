// Admin decides on a variance claim. POST /approve or /reject is shorter,
// but a single PATCH with {status, decision_note, claimed_amount?} keeps
// the surface flat and matches the rest of the admin endpoints.
//
// Approving a claim does NOT immediately rewrite supplier_freight_cost —
// that happens when the supplier transitions the order to in_transit
// (the dispatch endpoint reads the latest approved claim). This avoids
// race conditions and keeps the dispatch endpoint as the single writer.

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { sendClaimDecisionEmails } from "@/lib/fulfillment/supplier-emails"

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const {
    error: authError,
    supabase,
    user,
  } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params

  const body = await request.json()
  const status = body.status as "approved" | "rejected" | undefined
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 },
    )
  }

  const update: Record<string, unknown> = {
    status,
    decision_note: body.decision_note ?? null,
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  }
  if (status === "approved" && body.claimed_amount !== undefined) {
    update.claimed_amount = Number(body.claimed_amount)
  }

  const { error } = await supabase
    .from("freight_variance_claims")
    .update(update)
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  sendClaimDecisionEmails({ supabase, claimId: id }).catch((err) =>
    console.error("[claim decision email] failed:", err),
  )

  return NextResponse.json({ ok: true })
}
