/**
 * POST /api/marketing/campaigns/[id]/send
 *
 * Dispatches a campaign immediately. Enforces:
 *   - status must be draft or scheduled
 *   - required fields must be present (subject+HTML for email, body_text for
 *     SMS, ghl_workflow_id for workflow campaigns)
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { dispatchCampaign, type CampaignRow } from "@/lib/marketing/dispatcher"

// Campaign sends run per-recipient sequentially with pacing; large audiences
// need the full Vercel Pro budget.
export const maxDuration = 60

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { data: campaign, error: dbError } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!["draft", "scheduled"].includes(campaign.status)) {
    return NextResponse.json(
      { error: `Campaign already ${campaign.status}, cannot send again` },
      { status: 409 },
    )
  }

  if (campaign.type === "email" && (!campaign.subject || !campaign.body_html)) {
    return NextResponse.json(
      { error: "Email campaign is missing subject or body_html" },
      { status: 400 },
    )
  }
  if (campaign.type === "sms" && !campaign.body_text) {
    return NextResponse.json(
      { error: "SMS campaign is missing body_text" },
      { status: 400 },
    )
  }
  if (campaign.type === "ghl_workflow" && !campaign.ghl_workflow_id) {
    return NextResponse.json(
      { error: "Workflow campaign is missing a GHL workflow selection" },
      { status: 400 },
    )
  }

  try {
    const result = await dispatchCampaign(supabase, campaign as CampaignRow)
    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "campaign.sent",
      target_type: "campaign",
      target_id: id,
      meta: {
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
        audience: result.audienceCount,
      },
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from("marketing_campaigns")
      .update({ status: "failed" })
      .eq("id", id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
