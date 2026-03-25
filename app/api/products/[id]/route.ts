import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/products/[id] - get single product (public)
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createServerSupabaseClient()

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  const { data, error } = isUuid
    ? await supabase.from("products").select("*").eq("id", id).single()
    : await supabase.from("products").select("*").eq("slug", id).single()

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

  if (body.name) {
    body.slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const { data, error } = await supabase
    .from("products")
    .update(body)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
