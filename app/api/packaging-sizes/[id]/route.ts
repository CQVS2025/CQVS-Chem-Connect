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

  const { data, error } = await supabase
    .from("packaging_sizes")
    .update({
      name: body.name,
      volume_litres: body.volume_litres ?? null,
      container_type: body.container_type,
      sort_order: body.sort_order,
      is_active: body.is_active,
    })
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

  // Soft delete by deactivating - hard delete would break historical orders
  const { error } = await supabase
    .from("packaging_sizes")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
