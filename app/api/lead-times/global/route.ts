import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

/**
 * POST /api/lead-times/global
 *
 * Upsert the single global lead time row.
 * Body: { manufacturing_days, buffer_days, use_business_days }
 * Admin required.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  const manufacturingDays = Number(body.manufacturing_days)
  const bufferDays = Number(body.buffer_days ?? 0)

  if (!Number.isInteger(manufacturingDays) || manufacturingDays < 0) {
    return NextResponse.json(
      { error: "manufacturing_days must be a non-negative integer" },
      { status: 400 },
    )
  }

  // Fetch the existing row so we know its ID for upsert
  const { data: existing } = await supabase
    .from("lead_time_global")
    .select("id")
    .limit(1)
    .maybeSingle()

  const payload = {
    manufacturing_days: manufacturingDays,
    buffer_days: Math.max(0, bufferDays),
    use_business_days: body.use_business_days ?? true,
    updated_at: new Date().toISOString(),
  }

  let data, error

  if (existing?.id) {
    ;({ data, error } = await supabase
      .from("lead_time_global")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single())
  } else {
    ;({ data, error } = await supabase
      .from("lead_time_global")
      .insert(payload)
      .select()
      .single())
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
