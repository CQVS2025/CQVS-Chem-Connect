import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

/**
 * GET /api/product-warehouses
 *
 * Query params (at least one required):
 *   ?warehouse_id=X  - returns all products mapped to this warehouse
 *   ?product_id=X    - returns all warehouses for this product
 *
 * Returns: Array of { id, product_id, warehouse_id, product, warehouse }
 * Admin required.
 */
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const warehouseId = searchParams.get("warehouse_id")
  const productId = searchParams.get("product_id")

  if (!warehouseId && !productId) {
    return NextResponse.json(
      { error: "warehouse_id or product_id query param is required" },
      { status: 400 },
    )
  }

  let query = supabase
    .from("product_warehouses")
    .select(
      "id, product_id, warehouse_id, product:products(id, name, slug), warehouse:warehouses(id, name)",
    )

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId)
  }
  if (productId) {
    query = query.eq("product_id", productId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/**
 * POST /api/product-warehouses
 *
 * Create a product↔warehouse mapping.
 * Body: { product_id, warehouse_id }
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

  const { data, error } = await supabase
    .from("product_warehouses")
    .insert({
      product_id: body.product_id,
      warehouse_id: body.warehouse_id,
    })
    .select(
      "id, product_id, warehouse_id, product:products(id, name, slug), warehouse:warehouses(id, name)",
    )
    .single()

  if (error) {
    // Unique violation - mapping already exists
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This product is already mapped to this warehouse" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

/**
 * DELETE /api/product-warehouses?product_id=X&warehouse_id=Y
 *
 * Remove a product↔warehouse mapping.
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
    .from("product_warehouses")
    .delete()
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
