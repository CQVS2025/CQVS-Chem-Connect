import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data: tiers, error } = await supabase
    .from("reward_tiers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(tiers)
}

export async function PUT(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()
  const { id, ...updates } = body

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Valid Tier ID is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("reward_tiers")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
