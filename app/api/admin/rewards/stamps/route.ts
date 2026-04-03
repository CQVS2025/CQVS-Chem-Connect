import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  // Fetch stamp records
  const { data: stamps, error: fetchError } = await supabase
    .from("stamp_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Fetch profile info for all user_ids
  const userIds = [...new Set((stamps ?? []).map((s) => s.user_id))]

  let profiles: { id: string; contact_name: string; company_name: string; email: string }[] = []
  if (userIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, contact_name, company_name, email")
      .in("id", userIds)
    profiles = data ?? []
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const enriched = (stamps ?? []).map((s) => {
    const profile = profileMap.get(s.user_id)
    return {
      ...s,
      contact_name: profile?.contact_name ?? null,
      company_name: profile?.company_name ?? null,
      email: profile?.email ?? null,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { user_id, stamps_earned, notes } = body

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 })
  }

  // Upsert: find existing record for this user and increment, or create new
  const { data: existing } = await supabase
    .from("stamp_records")
    .select("id, stamps_earned, notes")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let data
  let insertError

  if (existing) {
    const updatedStamps = existing.stamps_earned + (stamps_earned || 1)
    const existingNotes = (existing.notes || "").replace(/\[orders:[^\]]*\]/, "").trim()
    const newNote = notes
      ? existingNotes ? `${existingNotes}, Manual: ${notes}` : `Manual: ${notes}`
      : existingNotes

    // Preserve the order tracking tag if it exists
    const orderTag = existing.notes?.match(/\[orders:[^\]]*\]/)?.[0] || ""
    const finalNotes = `${newNote} ${orderTag}`.trim()

    const result = await supabase
      .from("stamp_records")
      .update({ stamps_earned: updatedStamps, notes: finalNotes || null })
      .eq("id", existing.id)
      .select()
      .single()

    data = result.data
    insertError = result.error
  } else {
    const result = await supabase
      .from("stamp_records")
      .insert({
        user_id,
        stamps_earned: stamps_earned || 1,
        notes: notes ? `Manual: ${notes}` : null,
      })
      .select()
      .single()

    data = result.data
    insertError = result.error
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { id, stamps_earned, notes } = body

  if (!id) {
    return NextResponse.json({ error: "Stamp record ID required" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (stamps_earned !== undefined) updates.stamps_earned = stamps_earned
  if (notes !== undefined) updates.notes = notes

  const { data, error: updateError } = await supabase
    .from("stamp_records")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Stamp record ID required" }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from("stamp_records")
    .delete()
    .eq("id", id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
