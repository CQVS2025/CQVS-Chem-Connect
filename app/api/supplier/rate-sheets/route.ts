// CRUD for supplier_rate_sheets + supplier_rate_sheet_brackets, scoped
// to the signed-in supplier's warehouse memberships.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const warehouseId = request.nextUrl.searchParams.get("warehouse_id")
  let q = supabase
    .from("supplier_rate_sheets")
    .select(
      "*, supplier_rate_sheet_brackets (id, distance_from_km, distance_to_km, rate)",
    )
    .order("created_at", { ascending: true })

  if (warehouseId) {
    if (!sctx.isAdmin && !sctx.warehouseIds.includes(warehouseId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    q = q.eq("warehouse_id", warehouseId)
  } else if (!sctx.isAdmin) {
    q = q.in("warehouse_id", sctx.warehouseIds)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  if (!body.warehouse_id || !body.name || !body.unit_type) {
    return NextResponse.json(
      { error: "warehouse_id, name, unit_type are required" },
      { status: 400 },
    )
  }

  if (
    !sctx.isAdmin &&
    !sctx.canUpdateWarehouseIds.includes(body.warehouse_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: sheet, error: sheetError } = await supabase
    .from("supplier_rate_sheets")
    .insert({
      warehouse_id: body.warehouse_id,
      name: body.name,
      unit_type: body.unit_type,
      origin_postcode: body.origin_postcode ?? null,
      is_active: body.is_active ?? true,
      min_charge: body.min_charge ?? null,
      out_of_range_behavior: body.out_of_range_behavior ?? "last_bracket",
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (sheetError || !sheet) {
    return NextResponse.json(
      { error: sheetError?.message ?? "insert failed" },
      { status: 500 },
    )
  }

  if (Array.isArray(body.brackets) && body.brackets.length > 0) {
    const rows = body.brackets.map(
      (b: {
        distance_from_km: number
        distance_to_km: number
        rate: number
      }) => ({
        rate_sheet_id: sheet.id,
        distance_from_km: b.distance_from_km,
        distance_to_km: b.distance_to_km,
        rate: b.rate,
      }),
    )
    const { error: bracketsError } = await supabase
      .from("supplier_rate_sheet_brackets")
      .insert(rows)
    if (bracketsError) {
      await supabase.from("supplier_rate_sheets").delete().eq("id", sheet.id)
      return NextResponse.json(
        { error: `Brackets insert failed: ${bracketsError.message}` },
        { status: 500 },
      )
    }
  }

  return NextResponse.json(sheet, { status: 201 })
}
