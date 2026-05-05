// POST /api/admin/orders/[id]/xero-billed   -> stamps xero_po_billed_at = now()
// DELETE /api/admin/orders/[id]/xero-billed  -> clears it (in case of mistake)
//
// Driven from the reconciliation view's "Mark as billed in Xero" button.
// Admin clicks it AFTER actually creating the Bill from the PO in Xero
// (with any approved-claim freight adjustment applied).

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params

  const { error } = await supabase
    .from("orders")
    .update({ xero_po_billed_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params

  const { error } = await supabase
    .from("orders")
    .update({ xero_po_billed_at: null })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
