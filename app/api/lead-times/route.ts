import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * GET /api/lead-times
 *
 * Returns:
 *   { global, warehouses: [], productWarehouse: [] }
 *
 * Query params:
 *   ?warehouse_id=X   - filter productWarehouse by warehouse
 *   ?product_id=X     - filter productWarehouse by product
 *   Both can be combined.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = request.nextUrl
  const warehouseId = searchParams.get("warehouse_id")
  const productId = searchParams.get("product_id")

  // Global (single row)
  const { data: globalData, error: globalError } = await supabase
    .from("lead_time_global")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (globalError) {
    return NextResponse.json({ error: globalError.message }, { status: 500 })
  }

  // Warehouse overrides
  let warehouseQuery = supabase
    .from("lead_time_warehouse")
    .select("*, warehouse:warehouses(id, name)")

  if (warehouseId) {
    warehouseQuery = warehouseQuery.eq("warehouse_id", warehouseId)
  }

  const { data: warehousesData, error: warehouseError } = await warehouseQuery

  if (warehouseError) {
    return NextResponse.json({ error: warehouseError.message }, { status: 500 })
  }

  // Product + warehouse overrides
  let pwQuery = supabase
    .from("lead_time_product_warehouse")
    .select(
      "*, warehouse:warehouses(id, name), product:products(id, name, slug)",
    )

  if (warehouseId) {
    pwQuery = pwQuery.eq("warehouse_id", warehouseId)
  }
  if (productId) {
    pwQuery = pwQuery.eq("product_id", productId)
  }

  const { data: pwData, error: pwError } = await pwQuery

  if (pwError) {
    return NextResponse.json({ error: pwError.message }, { status: 500 })
  }

  return NextResponse.json({
    global: globalData ?? null,
    warehouses: warehousesData ?? [],
    productWarehouse: pwData ?? [],
  })
}
