import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch or create customer rewards record
  let { data: rewards } = await supabase
    .from("customer_rewards")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!rewards) {
    const { data: newRewards, error } = await supabase
      .from("customer_rewards")
      .upsert({ user_id: user.id }, { onConflict: "user_id" })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    rewards = newRewards
  }

  // Calculate current month spend from orders
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: monthOrders } = await supabase
    .from("orders")
    .select("total")
    .eq("user_id", user.id)
    .gte("created_at", firstOfMonth)
    .in("payment_status", ["paid"])

  const currentMonthSpend = monthOrders?.reduce(
    (sum, o) => sum + (parseFloat(o.total) || 0),
    0
  ) ?? 0

  // Calculate annual spend
  const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString()

  const { data: yearOrders } = await supabase
    .from("orders")
    .select("total")
    .eq("user_id", user.id)
    .gte("created_at", firstOfYear)
    .in("payment_status", ["paid"])

  const annualSpend = yearOrders?.reduce(
    (sum, o) => sum + (parseFloat(o.total) || 0),
    0
  ) ?? 0

  // Sum stamps from IBC orders (not count - a record can have 0 stamps if edited)
  const { data: stampData } = await supabase
    .from("stamp_records")
    .select("stamps_earned")
    .eq("user_id", user.id)

  const stampCount = stampData?.reduce((sum, r) => sum + (r.stamps_earned ?? 0), 0) ?? 0

  // Count referrals
  const { count: referralCount } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", user.id)
    .eq("status", "converted")

  // Determine tier from database thresholds
  const { data: tiers } = await supabase
    .from("reward_tiers")
    .select("name, min_monthly_spend")
    .eq("is_active", true)
    .order("min_monthly_spend", { ascending: false })

  let currentTier = "none"
  if (tiers) {
    for (const tier of tiers) {
      if (currentMonthSpend >= tier.min_monthly_spend) {
        currentTier = tier.name
        break
      }
    }
  }

  // Update rewards record
  await supabase
    .from("customer_rewards")
    .update({
      current_tier: currentTier,
      current_month_spend: currentMonthSpend,
      annual_spend: annualSpend,
      total_stamps: stampCount ?? 0,
      referral_count: referralCount ?? 0,
    })
    .eq("user_id", user.id)

  return NextResponse.json({
    ...rewards,
    current_tier: currentTier,
    current_month_spend: currentMonthSpend,
    annual_spend: annualSpend,
    total_stamps: stampCount ?? 0,
    referral_count: referralCount ?? 0,
  })
}
