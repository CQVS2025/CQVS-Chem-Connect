import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/packaging-sizes - list packaging sizes
// ?include_inactive=true       → admin: returns all sizes (incl. inactive)
// ?include_hidden=true          → admin: includes is_visible_on_storefront=false
// Default (public): only active AND visible on storefront (component 18 -
// hides Phase-1-deferred AdBlue 10L/200L/IBC sizes from buyers).
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const params = request.nextUrl.searchParams
  const includeInactive = params.get("include_inactive") === "true"
  const includeHidden = params.get("include_hidden") === "true"

  let query = supabase
    .from("packaging_sizes")
    .select("*")
    .order("sort_order", { ascending: true })

  if (!includeInactive) query = query.eq("is_active", true)
  if (!includeHidden) query = query.eq("is_visible_on_storefront", true)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/packaging-sizes - create new packaging size (admin)
export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("packaging_sizes")
    .insert({
      name: body.name.trim(),
      volume_litres: body.volume_litres ?? null,
      container_type: body.container_type || "drum",
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      is_visible_on_storefront: body.is_visible_on_storefront ?? true,
      units_per_pallet:
        typeof body.units_per_pallet === "number" && body.units_per_pallet > 0
          ? body.units_per_pallet
          : null,
      unit_weight_kg:
        typeof body.unit_weight_kg === "number" && body.unit_weight_kg > 0
          ? body.unit_weight_kg
          : null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505" || error.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: `A packaging size named "${body.name.trim()}" already exists. If it was deactivated, reactivate it instead of creating a new one.` },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
