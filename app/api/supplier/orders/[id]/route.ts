// GET single supplier order with full detail.
//
// orders.user_id references auth.users (not profiles), so we can't embed
// the buyer profile via a single PostgREST select. Two-step fetch:
//   1. Order + order_items via the supplier's session client (RLS
//      restricts to assigned warehouses).
//   2. Buyer profile via service role (the supplier's session can only
//      read their own profile row, but Q8 explicitly grants suppliers
//      visibility of the buyer's contact details for dispatch ops).

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `*, order_items (id, product_id, product_name, quantity, packaging_size, packaging_size_id, unit_price, total_price)`,
    )
    .eq("id", id)
    .single()

  if (error || !order) {
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: 404 },
    )
  }

  if (!sctx.isAdmin && !sctx.warehouseIds.includes(order.warehouse_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Buyer profile lookup via service role (RLS would block the supplier
  // session from reading anyone else's profiles row).
  const service = createServiceRoleClient()
  const { data: buyerProfile } = await service
    .from("profiles")
    .select("contact_name, email, phone, company_name")
    .eq("id", (order as { user_id: string }).user_id)
    .maybeSingle()

  return NextResponse.json({ ...order, profiles: buyerProfile ?? null })
}
