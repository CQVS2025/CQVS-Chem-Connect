import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params
  const body = await request.json()

  const { brackets, ...sheetUpdate } = body

  if (Object.keys(sheetUpdate).length > 0) {
    const { error } = await supabase
      .from("supplier_rate_sheets")
      .update(sheetUpdate)
      .eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace bracket set if provided. (Edits are atomic — admin re-uploads
  // the matrix.)
  if (Array.isArray(brackets)) {
    await supabase.from("supplier_rate_sheet_brackets").delete().eq("rate_sheet_id", id)
    if (brackets.length > 0) {
      const rows = brackets.map(
        (b: { distance_from_km: number; distance_to_km: number; rate: number }) => ({
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
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params
  const { error } = await supabase
    .from("supplier_rate_sheets")
    .delete()
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
