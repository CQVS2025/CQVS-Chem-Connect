/**
 * POST /api/marketing/campaigns/[id]/preview
 *
 * Returns audience count + rendered HTML (for the review step of the wizard).
 * Non-destructive — no GHL calls, no sends.
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { previewCampaign } from "@/lib/marketing/dispatcher"
import type { AudienceFilter } from "@/lib/marketing/audience"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireMarketingRole("view")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { data: campaign, error: dbError } = await supabase
    .from("marketing_campaigns")
    .select(
      "id, name, type, subject, preheader, body_html, body_text, from_email, from_name, reply_to, audience_filter",
    )
    .eq("id", id)
    .maybeSingle()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const audience = await previewCampaign(
    supabase,
    campaign.audience_filter as AudienceFilter,
  )
  return NextResponse.json({ campaign, ...audience })
}
