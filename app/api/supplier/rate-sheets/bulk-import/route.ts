// POST /api/supplier/rate-sheets/bulk-import
//
// Mirror of the admin bulk-import, scoped via requireSupplier so each
// supplier can only target a warehouse they're assigned to with
// can_update_orders = true.

import { NextRequest, NextResponse } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"

const VALID_UNIT_TYPES = new Set([
  "per_litre",
  "flat_per_consignment",
  "per_kg",
  "per_pallet",
  "per_zone",
])
const VALID_OOR = new Set(["last_bracket", "block", "quote_on_application"])

interface IncomingSheet {
  name: string
  unit_type: string
  is_active?: boolean
  origin_postcode?: string | null
  min_charge?: number | null
  out_of_range_behavior?: string
  brackets: Array<{
    distance_from_km: number
    distance_to_km: number
    rate: number
  }>
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase, ctx: sctx } = await requireSupplier()
  if (authError) return authError
  if (!sctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const warehouseId = body.warehouse_id as string | undefined
  const sheets = body.sheets as IncomingSheet[] | undefined

  if (!warehouseId || !Array.isArray(sheets) || sheets.length === 0) {
    return NextResponse.json(
      { error: "warehouse_id and a non-empty sheets[] array are required" },
      { status: 400 },
    )
  }

  if (!sctx.isAdmin && !sctx.canUpdateWarehouseIds.includes(warehouseId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  for (const [i, s] of sheets.entries()) {
    if (!s.name || typeof s.name !== "string") {
      return NextResponse.json(
        { error: `sheets[${i}].name is required` },
        { status: 400 },
      )
    }
    if (!VALID_UNIT_TYPES.has(s.unit_type)) {
      return NextResponse.json(
        {
          error: `sheets[${i}].unit_type must be one of: ${[...VALID_UNIT_TYPES].join(", ")}`,
        },
        { status: 400 },
      )
    }
    if (
      s.out_of_range_behavior &&
      !VALID_OOR.has(s.out_of_range_behavior)
    ) {
      return NextResponse.json(
        {
          error: `sheets[${i}].out_of_range_behavior must be one of: ${[...VALID_OOR].join(", ")}`,
        },
        { status: 400 },
      )
    }
    if (!Array.isArray(s.brackets) || s.brackets.length === 0) {
      return NextResponse.json(
        {
          error: `sheets[${i}] (${s.name}): at least one bracket is required`,
        },
        { status: 400 },
      )
    }
    for (const [bIdx, b] of s.brackets.entries()) {
      if (
        !Number.isFinite(b.distance_from_km) ||
        !Number.isFinite(b.distance_to_km) ||
        !Number.isFinite(b.rate) ||
        b.distance_to_km <= b.distance_from_km
      ) {
        return NextResponse.json(
          {
            error: `sheets[${i}] (${s.name}): bracket ${bIdx + 1} is malformed (need from < to and a numeric rate)`,
          },
          { status: 400 },
        )
      }
    }
  }

  const created: string[] = []
  for (const s of sheets) {
    const { data: sheet, error: sheetErr } = await supabase
      .from("supplier_rate_sheets")
      .insert({
        warehouse_id: warehouseId,
        name: s.name,
        unit_type: s.unit_type,
        is_active: s.is_active ?? true,
        origin_postcode: s.origin_postcode ?? null,
        min_charge: s.min_charge ?? null,
        out_of_range_behavior: s.out_of_range_behavior ?? "last_bracket",
      })
      .select()
      .single()

    if (sheetErr || !sheet) {
      await rollback(supabase, created)
      return NextResponse.json(
        {
          error: `Failed to create rate sheet "${s.name}": ${sheetErr?.message ?? "unknown error"}`,
          rolled_back: created.length,
        },
        { status: 500 },
      )
    }
    created.push(sheet.id)

    const { error: bracketsErr } = await supabase
      .from("supplier_rate_sheet_brackets")
      .insert(
        s.brackets.map((b) => ({
          rate_sheet_id: sheet.id,
          distance_from_km: b.distance_from_km,
          distance_to_km: b.distance_to_km,
          rate: b.rate,
        })),
      )
    if (bracketsErr) {
      await rollback(supabase, created)
      return NextResponse.json(
        {
          error: `Failed to create brackets for "${s.name}": ${bracketsErr.message}`,
          rolled_back: created.length,
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json(
    { ok: true, created: created.length, rate_sheet_ids: created },
    { status: 201 },
  )
}

async function rollback(
  supabase: Awaited<ReturnType<typeof requireSupplier>>["supabase"],
  ids: string[],
) {
  if (ids.length === 0) return
  await supabase.from("supplier_rate_sheets").delete().in("id", ids)
}
