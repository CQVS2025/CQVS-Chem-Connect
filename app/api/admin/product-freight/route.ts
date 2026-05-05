// CRUD for product_freight_rate_sheets — maps a product+packaging size
// combination to a rate sheet (component 4).

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const productId = request.nextUrl.searchParams.get("product_id")
  let q = supabase.from("product_freight_rate_sheets").select("*")
  if (productId) q = q.eq("product_id", productId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const body = await request.json()
  if (!body.product_id || !body.rate_sheet_id) {
    return NextResponse.json(
      { error: "product_id and rate_sheet_id are required" },
      { status: 400 },
    )
  }

  const productId = body.product_id as string
  const packagingSizeId = (body.packaging_size_id ?? null) as string | null
  const rateSheetId = body.rate_sheet_id as string

  // Migration 051 uses two PARTIAL unique indexes (one for NULL packaging,
  // one for non-NULL), so Postgres ON CONFLICT can't target them. Do an
  // explicit delete-then-insert instead — semantically the same upsert
  // and matches the DELETE handler below.
  let delQ = supabase
    .from("product_freight_rate_sheets")
    .delete()
    .eq("product_id", productId)
  delQ = packagingSizeId
    ? delQ.eq("packaging_size_id", packagingSizeId)
    : delQ.is("packaging_size_id", null)
  const { error: delErr } = await delQ
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from("product_freight_rate_sheets")
    .insert({
      product_id: productId,
      packaging_size_id: packagingSizeId,
      rate_sheet_id: rateSheetId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const productId = request.nextUrl.searchParams.get("product_id")
  const packagingSizeId = request.nextUrl.searchParams.get("packaging_size_id")
  if (!productId) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 })
  }
  let q = supabase
    .from("product_freight_rate_sheets")
    .delete()
    .eq("product_id", productId)
  q = packagingSizeId
    ? q.eq("packaging_size_id", packagingSizeId)
    : q.is("packaging_size_id", null)
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
