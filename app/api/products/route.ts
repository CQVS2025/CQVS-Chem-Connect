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

  let query = supabase.from("products").select("*")

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

  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const { data, error } = await supabase
    .from("products")
    .insert({ ...body, slug })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
