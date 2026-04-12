import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

/**
 * GET /api/product-warehouses
 *
 * Query params (at least one required):
 *   ?warehouse_id=X  - returns all products mapped to this warehouse
 *   ?product_id=X    - returns all warehouses for this product
 *
 * Returns: Array of { id, product_id, warehouse_id, packaging_size_id, product, warehouse, packaging_size }
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
      "id, product_id, warehouse_id, packaging_size_id, product:products(id, name, slug), warehouse:warehouses(id, name), packaging_size:packaging_sizes(id, name)",
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
 * Create a product↔warehouse mapping (optionally for a specific packaging size).
 * Body: { product_id, warehouse_id, packaging_size_id? }
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

  const insertPayload: Record<string, string> = {
    product_id: body.product_id,
    warehouse_id: body.warehouse_id,
  }
  if (body.packaging_size_id) {
    insertPayload.packaging_size_id = body.packaging_size_id
  }

  const { data, error } = await supabase
    .from("product_warehouses")
    .insert(insertPayload)
    .select(
      "id, product_id, warehouse_id, packaging_size_id, product:products(id, name, slug), warehouse:warehouses(id, name), packaging_size:packaging_sizes(id, name)",
    )
    .single()

  if (error) {
    // Unique violation - mapping already exists
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This product/size is already mapped to this warehouse" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

/**
 * DELETE /api/product-warehouses?product_id=X&warehouse_id=Y[&packaging_size_id=Z]
 *
 * Remove a product↔warehouse mapping.
 * If packaging_size_id is provided, only that specific size mapping is removed.
 * If not provided, all mappings for that product+warehouse are removed.
 * Admin required.
 */
export async function DELETE(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const productId = searchParams.get("product_id")
  const warehouseId = searchParams.get("warehouse_id")
  const packagingSizeId = searchParams.get("packaging_size_id")

  if (!productId || !warehouseId) {
    return NextResponse.json(
      { error: "product_id and warehouse_id query params are required" },
      { status: 400 },
    )
  }

  let query = supabase
    .from("product_warehouses")
    .delete()
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)

  if (packagingSizeId) {
    // Delete only the specific size mapping
    query = query.eq("packaging_size_id", packagingSizeId)
  }
  // If no packagingSizeId provided, delete ALL rows for this product+warehouse
  // (includes both null and non-null packaging_size_id rows)

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
