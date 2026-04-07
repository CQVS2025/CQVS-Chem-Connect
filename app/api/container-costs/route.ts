import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/container-costs - public read (needed at checkout)
// Optional query: ?warehouse_id=xxx to filter
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const warehouseId = request.nextUrl.searchParams.get("warehouse_id")

  let query = supabase
    .from("container_costs")
    .select(
      "*, warehouse:warehouses(id,name), packaging_size:packaging_sizes(id,name,volume_litres)",
    )

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST /api/container-costs - upsert (admin)
// Body: { warehouse_id, packaging_size_id, cost }
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  if (!body.warehouse_id || !body.packaging_size_id) {
    return NextResponse.json(
      { error: "warehouse_id and packaging_size_id are required" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("container_costs")
    .upsert(
      {
        warehouse_id: body.warehouse_id,
        packaging_size_id: body.packaging_size_id,
        cost: Number(body.cost) || 0,
      },
      { onConflict: "warehouse_id,packaging_size_id" },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
