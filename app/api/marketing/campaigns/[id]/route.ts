/**
 * GET    /api/marketing/campaigns/[id]          -- full row + event breakdown
 * PATCH  /api/marketing/campaigns/[id]          -- edit draft / scheduled
 * DELETE /api/marketing/campaigns/[id]          -- admin-only
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireMarketingRole("view")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { data: campaign, error: dbError } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!campaign)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: events } = await supabase
    .from("marketing_events")
    .select("id, event_type, contact_id, ghl_contact_id, metadata, occurred_at")
    .eq("campaign_id", id)
    .order("occurred_at", { ascending: false })
    .limit(200)

  return NextResponse.json({ campaign, events: events ?? [] })
}

const patchSchema = z.object({
  name: z.string().optional(),
  subject: z.string().optional().nullable(),
  preheader: z.string().optional().nullable(),
  body_html: z.string().optional().nullable(),
  body_text: z.string().optional().nullable(),
  from_email: z.string().optional().nullable(),
  from_name: z.string().optional().nullable(),
  reply_to: z.string().optional().nullable(),
  audience_filter: z.record(z.string(), z.unknown()).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  template_mode: z.enum(["plain", "branded", "custom_html"]).optional(),
})

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data: existing } = await supabase
    .from("marketing_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (existing.status === "sent" || existing.status === "sending") {
    return NextResponse.json(
      { error: `Cannot edit a campaign with status "${existing.status}"` },
      { status: 409 },
    )
  }

  const update: Record<string, unknown> = { ...parsed.data }
  if ("scheduled_at" in parsed.data) {
    update.status = parsed.data.scheduled_at ? "scheduled" : "draft"
  }

  const { error: dbError } = await supabase
    .from("marketing_campaigns")
    .update(update)
    .eq("id", id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "campaign.updated",
    target_type: "campaign",
    target_id: id,
    meta: { fields: Object.keys(parsed.data) },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("delete")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { data: existing } = await supabase
    .from("marketing_campaigns")
    .select("status")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.status === "sending") {
    return NextResponse.json(
      { error: "Cannot delete a campaign while it is sending" },
      { status: 409 },
    )
  }

  const { error: dbError } = await supabase
    .from("marketing_campaigns")
    .delete()
    .eq("id", id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "campaign.deleted",
    target_type: "campaign",
    target_id: id,
    meta: {},
  })
  return NextResponse.json({ ok: true })
}
