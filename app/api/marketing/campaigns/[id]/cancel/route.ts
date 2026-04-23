/**
 * POST /api/marketing/campaigns/[id]/cancel
 *
 * Cancels a draft or scheduled campaign. Sending campaigns cannot be
 * cancelled (they're already in-flight) — we surface a 409 in that case.
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { data: existing } = await supabase
    .from("marketing_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!["draft", "scheduled"].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot cancel a campaign with status "${existing.status}"` },
      { status: 409 },
    )
  }

  const { error: dbError } = await supabase
    .from("marketing_campaigns")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "campaign.cancelled",
    target_type: "campaign",
    target_id: id,
    meta: {},
  })
  return NextResponse.json({ ok: true })
}
