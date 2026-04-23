/**
 * GET /api/marketing/dashboard
 *
 * Returns widget data. If the marketing_dashboard_* views don't exist yet
 * (migration 033 not applied), we degrade gracefully: compute the numbers
 * directly from base tables so the page never hard-fails.
 */

import { NextResponse } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

interface MonthStats {
  emails_sent_this_month: number
  sms_sent_this_month: number
  delivered_this_month: number
  opened_this_month: number
  clicked_this_month: number
  active_campaigns: number
  scheduled_campaigns: number
}

interface ContactsStats {
  total_contacts: number
  new_this_week: number
  opted_out: number
}

interface InboxStats {
  unread_threads: number
  unread_messages: number
}

export async function GET() {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const supabase = createServiceRoleClient()

  const [monthRes, recentRes, inboxRes, contactsRes] = await Promise.all([
    supabase.from("marketing_dashboard_month").select("*").maybeSingle(),
    supabase.from("marketing_dashboard_recent_campaigns").select("*").limit(8),
    supabase.from("marketing_dashboard_inbox").select("*").maybeSingle(),
    supabase.from("marketing_dashboard_contacts").select("*").maybeSingle(),
  ])

  // If any view is missing (undefined_table), fall back to base-table queries.
  const viewsMissing =
    monthRes.error?.code === "42P01" ||
    recentRes.error?.code === "42P01" ||
    inboxRes.error?.code === "42P01" ||
    contactsRes.error?.code === "42P01"

  if (viewsMissing) {
    const [month, recent, inbox, contacts] = await Promise.all([
      computeMonthStats(supabase),
      computeRecentCampaigns(supabase),
      computeInboxStats(supabase),
      computeContactsStats(supabase),
    ])
    return NextResponse.json({
      month,
      recentCampaigns: recent,
      inbox,
      contacts,
      degraded: true,
    })
  }

  return NextResponse.json({
    month: monthRes.data ?? null,
    recentCampaigns: recentRes.data ?? [],
    inbox: inboxRes.data ?? null,
    contacts: contactsRes.data ?? null,
  })
}

async function computeMonthStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<MonthStats> {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString()

  const { data } = await supabase
    .from("marketing_campaigns")
    .select(
      "id, type, status, sent_at, delivered_count, opened_count, clicked_count",
    )

  const rows = data ?? []
  const inMonth = rows.filter(
    (r) => r.sent_at && new Date(r.sent_at) >= new Date(startOfMonth),
  )
  return {
    emails_sent_this_month: inMonth.filter((r) => r.type === "email").length,
    sms_sent_this_month: inMonth.filter((r) => r.type === "sms").length,
    delivered_this_month: inMonth.reduce(
      (sum, r) => sum + (r.delivered_count ?? 0),
      0,
    ),
    opened_this_month: inMonth.reduce(
      (sum, r) => sum + (r.opened_count ?? 0),
      0,
    ),
    clicked_this_month: inMonth.reduce(
      (sum, r) => sum + (r.clicked_count ?? 0),
      0,
    ),
    active_campaigns: rows.filter((r) => r.status === "sending").length,
    scheduled_campaigns: rows.filter((r) => r.status === "scheduled").length,
  }
}

async function computeRecentCampaigns(
  supabase: ReturnType<typeof createServiceRoleClient>,
) {
  const { data } = await supabase
    .from("marketing_campaigns")
    .select(
      "id, name, type, status, audience_count, delivered_count, opened_count, clicked_count, sent_at, scheduled_at, created_at",
    )
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(8)
  return (data ?? []).map((r) => ({
    ...r,
    open_rate:
      r.delivered_count > 0
        ? Math.round((r.opened_count / r.delivered_count) * 100 * 10) / 10
        : 0,
    click_rate:
      r.delivered_count > 0
        ? Math.round((r.clicked_count / r.delivered_count) * 100 * 10) / 10
        : 0,
  }))
}

async function computeInboxStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<InboxStats> {
  const { data } = await supabase
    .from("sms_conversations")
    .select("unread_count")
  const rows = data ?? []
  return {
    unread_threads: rows.filter((r) => (r.unread_count ?? 0) > 0).length,
    unread_messages: rows.reduce((sum, r) => sum + (r.unread_count ?? 0), 0),
  }
}

async function computeContactsStats(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<ContactsStats> {
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from("marketing_contacts")
    .select("id, created_at, deleted_at, is_opted_out")
  const rows = (data ?? []).filter((r) => !r.deleted_at)
  return {
    total_contacts: rows.length,
    new_this_week: rows.filter(
      (r) => new Date(r.created_at) >= new Date(startOfWeek),
    ).length,
    opted_out: rows.filter((r) => r.is_opted_out).length,
  }
}
