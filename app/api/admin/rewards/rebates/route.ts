import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Public GET - customers need to see rebate tiers
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("rebate_tiers")
    .select("*")
    .order("sort_order")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { min_annual_spend, rebate_percent } = body

  if (min_annual_spend === undefined || rebate_percent === undefined) {
    return NextResponse.json(
      { error: "min_annual_spend and rebate_percent are required" },
      { status: 400 }
    )
  }

  const { data, error: insertError } = await supabase
    .from("rebate_tiers")
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
    return NextResponse.json({ error: "Rebate tier ID required" }, { status: 400 })
  }

  const { data, error: updateError } = await supabase
    .from("rebate_tiers")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
