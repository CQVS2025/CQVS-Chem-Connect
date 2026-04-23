/**
 * POST /api/marketing/campaigns/run-scheduled
 *
 * Finds every `scheduled` campaign whose `scheduled_at` has passed and
 * dispatches it. Invoked by GitHub Actions
 * (.github/workflows/run-scheduled-campaigns.yml) every 5 minutes.
 *
 * Auth: shared secret in the `x-cron-secret` header (env: MARKETING_CRON_SECRET).
 *
 * Concurrency: processes due campaigns serially. Each dispatchCampaign call
 * is already parallelised internally (CONCURRENCY=6), so this is fine.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { dispatchCampaign, type CampaignRow } from "@/lib/marketing/dispatcher"
import { sendMarketingAlert } from "@/lib/marketing/alerts"

export const maxDuration = 60

async function authorize(request: NextRequest): Promise<boolean> {
  const expected = process.env.MARKETING_CRON_SECRET
  if (!expected) return false

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return provided === expected
}

async function handle(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { data: due, error: dbError } = await supabase.rpc(
    "due_scheduled_campaigns",
  )
  if (dbError) {
    await sendMarketingAlert({
      key: "scheduler.query_failed",
      subject: "Scheduled campaign query failed",
      body: `Error: ${dbError.message}`,
    })
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const campaigns = (due ?? []) as CampaignRow[]
  const results: Array<{
    campaignId: string
    succeeded: number
    failed: number
    error?: string
  }> = []

  for (const campaign of campaigns) {
    try {
      const res = await dispatchCampaign(supabase, campaign)
      results.push({
        campaignId: campaign.id,
        succeeded: res.succeeded,
        failed: res.failed,
      })
      await supabase.from("marketing_audit_log").insert({
        action: "campaign.scheduled_fired",
        target_type: "campaign",
        target_id: campaign.id,
        meta: {
          scheduled_at: campaign.audience_filter,
          succeeded: res.succeeded,
          failed: res.failed,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ campaignId: campaign.id, succeeded: 0, failed: 0, error: message })
      await supabase
        .from("marketing_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign.id)
      await sendMarketingAlert({
        key: `scheduler.campaign_failed.${campaign.id}`,
        subject: `Scheduled campaign "${campaign.name}" failed`,
        body: `Error: ${message}\n\nThe campaign was marked as failed. You can create a new campaign and resend manually.`,
      })
    }
  }

  return NextResponse.json({
    processed: campaigns.length,
    results,
  })
}

export const GET = handle
export const POST = handle
