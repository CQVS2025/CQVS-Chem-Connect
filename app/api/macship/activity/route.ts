import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

// GET /api/macship/activity - last 20 MacShip-related orders (admin only)
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      macship_consignment_id,
      macship_carrier_id,
      macship_pickup_date,
      macship_dispatched_at,
      macship_tracking_url,
      macship_manifest_id,
      macship_consignment_failed,
      macship_lead_time_fallback
    `)
    .not("macship_consignment_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
