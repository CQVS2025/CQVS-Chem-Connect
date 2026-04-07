import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/warehouses - list warehouses (public reads active ones)
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST /api/warehouses - create warehouse (admin)
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("warehouses")
    .insert({
      name: body.name.trim(),
      address_street: body.address_street || "",
      address_city: body.address_city || "",
      address_state: body.address_state || "",
      address_postcode: body.address_postcode || "",
      contact_name: body.contact_name || null,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      xero_contact_id: body.xero_contact_id || null,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
