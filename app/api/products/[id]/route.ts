import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/products/[id] - get single product (public, includes packaging prices)
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createServerSupabaseClient()

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const select = `*, packaging_prices:product_packaging_prices(*, packaging_size:packaging_sizes(*))`

  const { data, error } = isUuid
    ? await supabase.from("products").select(select).eq("id", id).single()
    : await supabase.from("products").select(select).eq("slug", id).single()

  if (error || !data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/products/[id] - update product (admin only)
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  // Strip out packaging_prices to update separately
  const { packaging_prices: packagingPrices, ...productData } = body

  if (productData.name) {
    productData.slug = productData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const { data, error } = await supabase
    .from("products")
    .update(productData)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace packaging prices if provided (delete + insert for simplicity)
  if (Array.isArray(packagingPrices)) {
    await supabase
      .from("product_packaging_prices")
      .delete()
      .eq("product_id", id)

    if (packagingPrices.length > 0) {
      const rows = packagingPrices.map((pp: {
        packaging_size_id: string
        price_per_litre?: number | null
        fixed_price?: number | null
      }) => ({
        product_id: id,
        packaging_size_id: pp.packaging_size_id,
        price_per_litre: pp.price_per_litre ?? null,
        fixed_price: pp.fixed_price ?? null,
      }))

      const { error: ppError } = await supabase
        .from("product_packaging_prices")
        .insert(rows)

      if (ppError) {
        console.error("Failed to update packaging prices:", ppError.message)
      }
    }
  }

  return NextResponse.json(data)
}

// DELETE /api/products/[id] - delete product (admin only)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { error } = await supabase.from("products").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
