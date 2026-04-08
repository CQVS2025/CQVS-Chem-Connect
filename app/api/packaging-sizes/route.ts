import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/packaging-sizes - list all active packaging sizes (public)
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("packaging_sizes")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

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
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
