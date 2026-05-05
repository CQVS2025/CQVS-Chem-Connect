import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/products/[id] - get single product (public, includes packaging prices)
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createServerSupabaseClient()
  const includeHidden =
    request.nextUrl.searchParams.get("include_hidden") === "true"

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const select = `*, packaging_prices:product_packaging_prices(*, packaging_size:packaging_sizes(*))`

  const { data, error } = isUuid
    ? await supabase.from("products").select(select).eq("id", id).single()
    : await supabase.from("products").select(select).eq("slug", id).single()

  if (error || !data) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  // Two-layer visibility filter (component 18). Per-product opt-out
  // (is_available) is the AdBlue Phase 1 mechanism; global flag
  // (is_visible_on_storefront) is for retiring container types.
  if (!includeHidden) {
    const product = data as {
      packaging_prices?: Array<{
        is_available?: boolean
        packaging_size?: { is_visible_on_storefront?: boolean } | null
      }>
    }
    if (Array.isArray(product.packaging_prices)) {
      product.packaging_prices = product.packaging_prices.filter(
        (pp) =>
          pp.is_available !== false &&
          pp.packaging_size?.is_visible_on_storefront !== false,
      )
    }
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

  // Replace packaging prices if provided (delete + insert for simplicity).
  //
  // We snapshot is_available BEFORE deleting so the visibility flag is
  // preserved across saves. Without this, every admin save would default
  // is_available back to true and silently un-hide variants the admin (or
  // a Phase 1 Adblue migration) had explicitly hidden.
  //
  // The form payload itself doesn't expose is_available yet - we honour
  // either an explicit value passed in by the caller (so a future UI
  // toggle works) OR the previously-stored value for that packaging_size.
  if (Array.isArray(packagingPrices)) {
    const { data: priorRows } = await supabase
      .from("product_packaging_prices")
      .select("packaging_size_id, is_available")
      .eq("product_id", id)
    const priorAvailability = new Map<string, boolean>(
      (priorRows ?? []).map(
        (r: { packaging_size_id: string; is_available: boolean }) => [
          r.packaging_size_id,
          r.is_available,
        ],
      ),
    )

    await supabase
      .from("product_packaging_prices")
      .delete()
      .eq("product_id", id)

    if (packagingPrices.length > 0) {
      const rows = packagingPrices.map((pp: {
        packaging_size_id: string
        price_per_litre?: number | null
        fixed_price?: number | null
        minimum_order_quantity?: number | null
        is_available?: boolean
      }) => ({
        product_id: id,
        packaging_size_id: pp.packaging_size_id,
        price_per_litre: pp.price_per_litre ?? null,
        fixed_price: pp.fixed_price ?? null,
        minimum_order_quantity: pp.minimum_order_quantity ?? 1,
        is_available:
          pp.is_available ??
          priorAvailability.get(pp.packaging_size_id) ??
          true,
      }))

      const { error: ppError } = await supabase
        .from("product_packaging_prices")
        .insert(rows)

      if (ppError) {
        console.error("Failed to update packaging prices:", ppError.message)
      }

      // Remove warehouse mappings for sizes that no longer exist on this product
      const newSizeIds = packagingPrices.map((pp: { packaging_size_id: string }) => pp.packaging_size_id)
      await supabase
        .from("product_warehouses")
        .delete()
        .eq("product_id", id)
        .not("packaging_size_id", "is", null)
        .not("packaging_size_id", "in", `(${newSizeIds.join(",")})`)
    } else {
      // All sizes removed - delete all specific-size warehouse mappings for this product
      await supabase
        .from("product_warehouses")
        .delete()
        .eq("product_id", id)
        .not("packaging_size_id", "is", null)
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
