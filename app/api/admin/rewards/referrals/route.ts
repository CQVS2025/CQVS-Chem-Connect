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

  // Enrich with referred person's order count
  const referredEmails = (referrals ?? [])
    .map((r) => r.referred_email)
    .filter(Boolean) as string[]

  let orderCounts = new Map<string, number>()

  if (referredEmails.length > 0) {
    // Find profiles matching referred emails
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("email", referredEmails)

    if (profiles && profiles.length > 0) {
      const userIds = profiles.map((p) => p.id)

      // Count orders per user
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id")
        .in("user_id", userIds)

      const emailToUserId = new Map(profiles.map((p) => [p.email, p.id]))

      // Count orders per email
      for (const email of referredEmails) {
        const userId = emailToUserId.get(email)
        if (userId) {
          const count = orders?.filter((o) => o.user_id === userId).length ?? 0
          orderCounts.set(email, count)
        }
      }
    }
  }

  const enriched = (referrals ?? []).map((r) => ({
    ...r,
    referred_order_count: r.referred_email ? (orderCounts.get(r.referred_email) ?? 0) : 0,
  }))

  return NextResponse.json(enriched)
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
  if (status !== undefined) updates.status = status
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
