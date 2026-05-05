import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/products - list all products (public)
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = request.nextUrl

  const category = searchParams.get("category")
  const region = searchParams.get("region")
  const inStock = searchParams.get("inStock")
  const search = searchParams.get("search")
  const sort = searchParams.get("sort")
  const includePricing = searchParams.get("includePricing") === "true"
  const includeInactive = searchParams.get("include_inactive") === "true"
  // Phase 1 component 18: hide AdBlue's deferred packaging sizes from the
  // public storefront. Admin tools pass ?include_hidden=true to see all.
  const includeHidden = searchParams.get("include_hidden") === "true"

  // Always join packaging_prices + packaging_size so the catalogue tile
  // chips, AddToCart selectors, and detail page see the SAME filtered
  // set of available sizes. Without this join the listing falls back to
  // the legacy `products.packaging_sizes` text array, which drifts
  // whenever admin toggles is_available or edits a product.
  const selectClause =
    "*, packaging_prices:product_packaging_prices(*, packaging_size:packaging_sizes(*))"

  let query = supabase.from("products").select(selectClause)

  // Always hide inactive products from public queries.
  // Pass ?include_inactive=true (admin only) to see all products.
  if (!includeInactive) {
    query = query.eq("is_active", true)
  }

  if (category && category !== "All") {
    query = query.eq("category", category)
  }
  if (region && region !== "All") {
    query = query.eq("region", region)
  }
  if (inStock === "true") {
    query = query.eq("in_stock", true)
  }
  if (search) {
    query = query.ilike("name", `%${search}%`)
  }

  switch (sort) {
    case "price-asc":
      query = query.order("price", { ascending: true })
      break
    case "price-desc":
      query = query.order("price", { ascending: false })
      break
    case "name-asc":
      query = query.order("name", { ascending: true })
      break
    case "name-desc":
      query = query.order("name", { ascending: false })
      break
    default:
      query = query.order("created_at", { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Two-layer visibility filter (skip both when admin asks for hidden):
  //   1. product_packaging_prices.is_available = false → this PRODUCT
  //      doesn't ship in this container (per-product opt-out, used for
  //      AdBlue Phase 1 to hide non-Bulk sizes only for AdBlue, leaving
  //      every other product's IBC / Drum / Jerry Can untouched).
  //   2. packaging_sizes.is_visible_on_storefront = false → the
  //      container type is retired across the catalogue (global).
  //
  // We rewrite the legacy `packaging_sizes` text array (used by the
  // catalogue tile chips) with names sourced from the visible price
  // rows. Falls back to the original text array if a product has no
  // price rows yet (older products not migrated to per-size pricing).
  if (Array.isArray(data)) {
    for (const p of data as Array<{
      packaging_sizes?: string[]
      packaging_prices?: Array<{
        is_available?: boolean
        packaging_size?: {
          name?: string
          sort_order?: number | null
          is_visible_on_storefront?: boolean
        } | null
      }>
    }>) {
      const visiblePrices = (p.packaging_prices ?? []).filter(
        (pp) =>
          (includeHidden || pp.is_available !== false) &&
          (includeHidden ||
            pp.packaging_size?.is_visible_on_storefront !== false),
      )

      // Rewrite packaging_sizes from the filtered price rows so tile
      // chips, AddToCart, and detail page all stay in sync.
      if (visiblePrices.length > 0) {
        p.packaging_sizes = visiblePrices
          .slice()
          .sort(
            (a, b) =>
              (a.packaging_size?.sort_order ?? 0) -
              (b.packaging_size?.sort_order ?? 0),
          )
          .map((pp) => pp.packaging_size?.name)
          .filter((n): n is string => !!n)
      }
      // else: keep the legacy text array (fallback for un-migrated products)

      if (includePricing) {
        p.packaging_prices = visiblePrices
      } else {
        // Caller didn't ask for full pricing - strip the join out of
        // the response to keep the payload light.
        delete p.packaging_prices
      }
    }
  }

  return NextResponse.json(data)
}

// POST /api/products - create a product (admin only)
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  // Strip out packaging_prices to insert separately
  const { packaging_prices: packagingPrices, ...productData } = body

  const slug = productData.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const { data: product, error } = await supabase
    .from("products")
    .insert({ ...productData, slug })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insert packaging prices if provided
  if (Array.isArray(packagingPrices) && packagingPrices.length > 0) {
    const rows = packagingPrices.map((pp: {
      packaging_size_id: string
      price_per_litre?: number | null
      fixed_price?: number | null
      minimum_order_quantity?: number | null
    }) => ({
      product_id: product.id,
      packaging_size_id: pp.packaging_size_id,
      price_per_litre: pp.price_per_litre ?? null,
      fixed_price: pp.fixed_price ?? null,
      minimum_order_quantity: pp.minimum_order_quantity ?? 1,
    }))

    const { error: ppError } = await supabase
      .from("product_packaging_prices")
      .insert(rows)

    if (ppError) {
      console.error("Failed to insert packaging prices:", ppError.message)
    }
  }

  return NextResponse.json(product, { status: 201 })
}
