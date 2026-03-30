import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET is public - customers need to see active promotions
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data: promotions, error: fetchError } = await supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(promotions)
}

export async function POST(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { name, type, discount_type } = body

  if (!name || !type || !discount_type) {
    return NextResponse.json(
      { error: "name, type, and discount_type are required" },
      { status: 400 }
    )
  }

  const { data, error: insertError } = await supabase
    .from("promotions")
    .insert(body)
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: "Promotion ID required" }, { status: 400 })
  }

  const { data, error: updateError } = await supabase
    .from("promotions")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
