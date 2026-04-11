import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

// GET /api/macship/failed-updates - list unresolved MacShip failed updates (admin only)
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("macship_failed_updates")
    .select(`
      id,
      order_id,
      reason,
      attempted_at,
      resolved,
      resolved_at,
      orders (
        order_number,
        status
      )
    `)
    .eq("resolved", false)
    .order("attempted_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []).map((row) => {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders
    return {
      id: row.id,
      order_id: row.order_id,
      order_number: order?.order_number ?? null,
      order_status: order?.status ?? null,
      consignment_id: null, // not stored in this table - reason field covers the detail
      error_message: row.reason,
      created_at: row.attempted_at,
      resolved: row.resolved,
    }
  })

  return NextResponse.json(rows)
}

// POST /api/macship/failed-updates - mark a failed update as resolved (admin only)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from("macship_failed_updates")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
