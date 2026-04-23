/**
 * GET /api/marketing/campaigns/[id]/analytics
 *
 * Returns aggregate metrics + paginated per-recipient rows for a single
 * campaign. Powers the analytics page under /admin/marketing/campaigns/
 * [id]/analytics. Test-send events are filtered out of both metrics and
 * recipients so the numbers reflect the real audience.
 *
 * Query params:
 *   page, size  — pagination (defaults 1, 25; size capped at 500 in SQL)
 *   status      — filter derived status (opened | clicked | bounced | ...)
 *   q           — case-insensitive search across name + email
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

interface RouteParams {
  params: Promise<{ id: string }>
}

interface RecipientRow {
  contact_id: string
  ghl_contact_id: string | null
  full_name: string | null
  email: string | null
  status: string
  last_activity_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  last_click_url: string | null
  total_count: number | null
}

interface MetricsRow {
  audience: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed: number
  failed: number
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const { id } = await params
  const url = new URL(request.url)
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1)
  const size = Math.min(
    Math.max(parseInt(url.searchParams.get("size") ?? "25", 10) || 25, 1),
    500,
  )
  const status = url.searchParams.get("status") || null
  const q = url.searchParams.get("q") || null

  const supabase = createServiceRoleClient()

  const { data: campaign, error: campaignError } = await supabase
    .from("marketing_campaigns")
    .select(
      "id, name, type, status, audience_count, subject, preheader, sent_at, scheduled_at, created_at",
    )
    .eq("id", id)
    .maybeSingle()
  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 })
  }
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  const [metricsRes, recipientsRes] = await Promise.all([
    supabase.rpc("get_campaign_metrics", { p_campaign_id: id }),
    supabase.rpc("get_campaign_recipients", {
      p_campaign_id: id,
      p_status: status,
      p_search: q,
      p_page_size: size,
      p_page: page,
    }),
  ])

  if (metricsRes.error) {
    return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })
  }
  if (recipientsRes.error) {
    return NextResponse.json(
      { error: recipientsRes.error.message },
      { status: 500 },
    )
  }

  const metricsRow = (metricsRes.data as MetricsRow[] | null)?.[0] ?? {
    audience: campaign.audience_count ?? 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    failed: 0,
  }

  const rows = (recipientsRes.data as RecipientRow[] | null) ?? []
  const total = rows[0]?.total_count ?? 0
  const recipients = rows.map(({ total_count: _tc, ...r }) => r)

  return NextResponse.json({
    campaign,
    metrics: metricsRow,
    recipients: {
      rows: recipients,
      page,
      pageSize: size,
      total,
      totalPages: Math.max(1, Math.ceil(Number(total) / size)),
    },
  })
}
