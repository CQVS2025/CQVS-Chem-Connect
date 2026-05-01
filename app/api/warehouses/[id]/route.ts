import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { syncWarehouseContactToXero } from "@/lib/xero/sync"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from("warehouses")
    .update({
      name: body.name,
      address_street: body.address_street,
      address_city: body.address_city,
      address_state: body.address_state,
      address_postcode: body.address_postcode,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      xero_contact_id: body.xero_contact_id ?? null,
      is_active: body.is_active,
      sort_order: body.sort_order,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (data?.id && data.xero_contact_id && data.contact_email) {
    await syncWarehouseContactToXero(data.id)
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { id } = await params

  // Soft delete to keep historical orders intact
  const { error } = await supabase
    .from("warehouses")
    .update({ is_active: false })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
