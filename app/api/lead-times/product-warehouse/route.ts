import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

/**
 * POST /api/lead-times/product-warehouse
 *
 * Upsert a product+warehouse lead time override.
 * Body: { product_id, warehouse_id, manufacturing_days, buffer_days, use_business_days, notes? }
 * Admin required.
 */
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  if (!body.product_id || !body.warehouse_id) {
    return NextResponse.json(
      { error: "product_id and warehouse_id are required" },
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
    .from("lead_time_product_warehouse")
    .upsert(
      {
        product_id: body.product_id,
        warehouse_id: body.warehouse_id,
        manufacturing_days: manufacturingDays,
        buffer_days: Math.max(0, Number(body.buffer_days ?? 0)),
        use_business_days: body.use_business_days ?? true,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,warehouse_id" },
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/lead-times/product-warehouse?product_id=X&warehouse_id=Y
 *
 * Remove a product+warehouse lead time override.
 * Admin required.
 */
export async function DELETE(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const productId = searchParams.get("product_id")
  const warehouseId = searchParams.get("warehouse_id")

  if (!productId || !warehouseId) {
    return NextResponse.json(
      { error: "product_id and warehouse_id query params are required" },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from("lead_time_product_warehouse")
    .delete()
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
