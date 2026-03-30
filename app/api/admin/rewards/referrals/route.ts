import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const { data: referrals, error: fetchError } = await supabase
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(referrals)
}

export async function PUT(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { id, status, reward_given, notes } = body

  if (!id) {
    return NextResponse.json({ error: "Referral ID is required" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (reward_given !== undefined) updates.reward_given = reward_given
  if (notes !== undefined) updates.notes = notes

  const { data, error: updateError } = await supabase
    .from("referrals")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
