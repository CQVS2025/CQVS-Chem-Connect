// GET /api/admin/supplier-fulfillment/audit-log?order_id=<uuid>
// Returns the per-order dispatch audit trail for the admin order detail panel.

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const orderId = request.nextUrl.searchParams.get("order_id")
  if (!orderId) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("order_supplier_audit_log")
    .select("id, field, old_value, new_value, created_at, actor_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
