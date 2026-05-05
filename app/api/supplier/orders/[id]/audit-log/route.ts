// GET /api/supplier/orders/[id]/audit-log
//
// Returns the dispatch audit trail for an order the supplier has access
// to. RLS already restricts the row set; this endpoint only adds an
// explicit ownership check for clearer 403 errors.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const { data: order } = await supabase
    .from("orders")
    .select("id, warehouse_id")
    .eq("id", id)
    .single()
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!sctx.isAdmin && !sctx.warehouseIds.includes(order.warehouse_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("order_supplier_audit_log")
    .select("id, field, old_value, new_value, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
