// Update / delete a single supplier_rate_sheet, scoped via requireSupplier.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

async function loadSheetWarehouseId(
  supabase: Awaited<ReturnType<typeof requireSupplier>>["supabase"],
  id: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("supplier_rate_sheets")
    .select("warehouse_id")
    .eq("id", id)
    .single()
  return (data as { warehouse_id: string } | null)?.warehouse_id ?? null
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const warehouseId = await loadSheetWarehouseId(supabase, id)
  if (!warehouseId)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!sctx.isAdmin && !sctx.canUpdateWarehouseIds.includes(warehouseId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { brackets, warehouse_id: _ignore, ...sheetUpdate } = body

  if (Object.keys(sheetUpdate).length > 0) {
    const { error } = await supabase
      .from("supplier_rate_sheets")
      .update(sheetUpdate)
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(brackets)) {
    await supabase
      .from("supplier_rate_sheet_brackets")
      .delete()
      .eq("rate_sheet_id", id)
    if (brackets.length > 0) {
      const rows = brackets.map(
        (b: {
          distance_from_km: number
          distance_to_km: number
          rate: number
        }) => ({
          rate_sheet_id: id,
          distance_from_km: b.distance_from_km,
          distance_to_km: b.distance_to_km,
          rate: b.rate,
        }),
      )
      const { error } = await supabase
        .from("supplier_rate_sheet_brackets")
        .insert(rows)
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params

  const warehouseId = await loadSheetWarehouseId(supabase, id)
  if (!warehouseId)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!sctx.isAdmin && !sctx.canUpdateWarehouseIds.includes(warehouseId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await supabase
    .from("supplier_rate_sheets")
    .delete()
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
