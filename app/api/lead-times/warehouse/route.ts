import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

/**
 * POST /api/lead-times/warehouse
 *
 * Upsert the lead time default for a specific warehouse.
 * Body: { warehouse_id, manufacturing_days, buffer_days, use_business_days, notes? }
 * Admin required.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  if (!body.warehouse_id) {
    return NextResponse.json(
      { error: "warehouse_id is required" },
      { status: 400 },
    )
  }

  const manufacturingDays = Number(body.manufacturing_days)
  if (!Number.isInteger(manufacturingDays) || manufacturingDays < 0) {
    return NextResponse.json(
      { error: "manufacturing_days must be a non-negative integer" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("lead_time_warehouse")
    .upsert(
      {
        warehouse_id: body.warehouse_id,
        manufacturing_days: manufacturingDays,
        buffer_days: Math.max(0, Number(body.buffer_days ?? 0)),
        use_business_days: body.use_business_days ?? true,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "warehouse_id" },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
