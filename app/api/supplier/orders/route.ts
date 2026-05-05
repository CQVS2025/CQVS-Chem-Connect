// GET /api/supplier/orders
// Lists orders scoped to the signed-in supplier's warehouse memberships.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase, ctx } = await requireSupplier()
  if (authError) return authError
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const status = request.nextUrl.searchParams.get("status")
  const search = request.nextUrl.searchParams.get("q")

  let query = supabase
    .from("orders")
    .select(
      `id, order_number, status, created_at, total, shipping,
       supplier_dispatch_date, estimated_delivery, supplier_dispatch_notes,
       supplier_tracking_url, supplier_variance_flagged, supplier_sla_breached,
       delivery_address_city, delivery_address_state, delivery_address_postcode,
       warehouse_id,
       order_items (product_name, quantity, packaging_size)`,
    )
    .order("created_at", { ascending: false })

  if (!ctx.isAdmin) {
    query = query.in("warehouse_id", ctx.warehouseIds)
  }
  if (status) query = query.eq("status", status)
  if (search) query = query.ilike("order_number", `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
