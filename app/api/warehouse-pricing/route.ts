import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/warehouse-pricing - admin only (cost prices are sensitive)
// Optional query: ?warehouse_id=xxx or ?product_id=xxx
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const warehouseId = request.nextUrl.searchParams.get("warehouse_id")
  const productId = request.nextUrl.searchParams.get("product_id")

  let query = supabase
    .from("warehouse_product_pricing")
    .select(
      "*, warehouse:warehouses(id,name), product:products(id,name), packaging_size:packaging_sizes(id,name,volume_litres)",
    )

  if (warehouseId) query = query.eq("warehouse_id", warehouseId)
  if (productId) query = query.eq("product_id", productId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST /api/warehouse-pricing - upsert (admin)
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  if (!body.warehouse_id || !body.product_id || !body.packaging_size_id) {
    return NextResponse.json(
      {
        error:
          "warehouse_id, product_id, and packaging_size_id are required",
      },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("warehouse_product_pricing")
    .upsert(
      {
        warehouse_id: body.warehouse_id,
        product_id: body.product_id,
        packaging_size_id: body.packaging_size_id,
        cost_price: Number(body.cost_price) || 0,
      },
      { onConflict: "warehouse_id,product_id,packaging_size_id" },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
