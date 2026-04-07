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

  const selectClause = includePricing
    ? `*, packaging_prices:product_packaging_prices(*, packaging_size:packaging_sizes(*))`
    : "*"

  let query = supabase.from("products").select(selectClause)

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
    }) => ({
      product_id: product.id,
      packaging_size_id: pp.packaging_size_id,
      price_per_litre: pp.price_per_litre ?? null,
      fixed_price: pp.fixed_price ?? null,
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
