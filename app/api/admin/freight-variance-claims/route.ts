// Admin queue: list all variance claims with order + warehouse context.

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const status = request.nextUrl.searchParams.get("status")
  let q = supabase
    .from("freight_variance_claims")
    .select(
      `*,
       orders!inner(order_number, shipping, status, freight_quote_snapshot, supplier_freight_cost),
       warehouses!inner(name)`,
    )
    .order("created_at", { ascending: false })

  if (status) q = q.eq("status", status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
