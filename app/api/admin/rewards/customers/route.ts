import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  // Fetch all customer rewards with profile info
  const { data: rewards, error: fetchError } = await supabase
    .from("customer_rewards")
    .select(`
      user_id,
      current_tier,
      current_month_spend,
      annual_spend,
      total_stamps,
      stamps_redeemed,
      referral_count,
      first_order_incentive_used,
      first_order_incentive_type
    `)
    .order("annual_spend", { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Fetch profiles for names
  const userIds = rewards?.map((r) => r.user_id) ?? []

  if (userIds.length === 0) {
    return NextResponse.json([])
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, contact_name, company_name, email")
    .in("id", userIds)

  const profileMap = new Map(
    profiles?.map((p) => [p.id, p]) ?? []
  )

  const enriched = rewards?.map((r) => {
    const profile = profileMap.get(r.user_id)
    return {
      ...r,
      contact_name: profile?.contact_name || "",
      company_name: profile?.company_name || "",
      email: profile?.email || "",
    }
  })

  return NextResponse.json(enriched)
}
