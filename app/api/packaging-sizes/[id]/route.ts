import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  const body = await request.json()

  const updatePayload: Record<string, unknown> = {
    name: body.name,
    volume_litres: body.volume_litres ?? null,
    container_type: body.container_type,
    sort_order: body.sort_order,
    is_active: body.is_active,
  }
  // Only include capacity fields if explicitly provided so partial updates work
  if (body.units_per_pallet !== undefined) {
    updatePayload.units_per_pallet =
      typeof body.units_per_pallet === "number" && body.units_per_pallet > 0
        ? body.units_per_pallet
        : null
  }
  if (body.unit_weight_kg !== undefined) {
    updatePayload.unit_weight_kg =
      typeof body.unit_weight_kg === "number" && body.unit_weight_kg > 0
        ? body.unit_weight_kg
        : null
  }
  if (body.is_visible_on_storefront !== undefined) {
    updatePayload.is_visible_on_storefront = !!body.is_visible_on_storefront
  }

  const { data, error } = await supabase
    .from("packaging_sizes")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { id } = await params

  const { error } = await supabase
    .from("packaging_sizes")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
