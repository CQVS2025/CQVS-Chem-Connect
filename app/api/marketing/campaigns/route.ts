/**
 * GET  /api/marketing/campaigns         -- list + filter by status/type
 * POST /api/marketing/campaigns         -- create draft
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(request: NextRequest) {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const sp = request.nextUrl.searchParams
  const status = sp.get("status")?.trim()
  const type = sp.get("type")?.trim()
  const limit = Math.min(Number(sp.get("limit") ?? 50), 200)
  const page = Math.max(Number(sp.get("page") ?? 1), 1)

  const supabase = createServiceRoleClient()
  let query = supabase
    .from("marketing_campaigns")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1)
  if (status) query = query.eq("status", status)
  if (type) query = query.eq("type", type)

  const { data, error: dbError, count } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  return NextResponse.json({ campaigns: data ?? [], total: count ?? 0, page, limit })
}

const createSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["email", "sms", "ghl_workflow"]),
    audience_filter: z
      .object({
        all: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        tagMatchAll: z.boolean().optional(),
        state: z.string().optional(),
        contactIds: z.array(z.string()).optional(),
      })
      .default({}),
    subject: z.string().optional().nullable(),
    preheader: z.string().optional().nullable(),
    body_html: z.string().optional().nullable(),
    body_text: z.string().optional().nullable(),
    from_email: z.string().optional().nullable(),
    from_name: z.string().optional().nullable(),
    reply_to: z.string().optional().nullable(),
    scheduled_at: z.string().datetime().optional().nullable(),
    recurring_rule: z.record(z.string(), z.unknown()).optional().nullable(),
    // ghl_workflow campaigns: the workflow built inside GHL that every
    // matched contact will be enrolled into on send. Name is cached at
    // create-time so we can render the campaign list without hitting GHL
    // (the name can still change on their side - that's fine, the ID is
    // the source of truth).
    ghl_workflow_id: z.string().min(1).optional().nullable(),
    ghl_workflow_name: z.string().optional().nullable(),
    // Distinguishes how body_html was rendered. Metadata only - the
    // wrapping is applied client-side before save. See migration 044.
    template_mode: z.enum(["plain", "branded", "custom_html"]).optional(),
  })
  .refine(
    (v) => v.type !== "ghl_workflow" || !!v.ghl_workflow_id,
    { message: "ghl_workflow_id is required when type is ghl_workflow", path: ["ghl_workflow_id"] },
  )

export async function POST(request: NextRequest) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  // Pull sender identity defaults from admin_settings if the client didn't
  // override. Keeps new campaigns consistent with the business profile.
  const { data: settingsRows } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", ["marketing.from_email", "marketing.from_name", "marketing.reply_to"])
  const settings: Record<string, string> = {}
  for (const row of settingsRows ?? []) {
    settings[row.key as string] = row.value as string
  }

  const { data: inserted, error: dbError } = await supabase
    .from("marketing_campaigns")
    .insert({
      name: parsed.data.name,
      type: parsed.data.type,
      status: parsed.data.scheduled_at ? "scheduled" : "draft",
      audience_filter: parsed.data.audience_filter,
      subject: parsed.data.subject ?? null,
      preheader: parsed.data.preheader ?? null,
      body_html: parsed.data.body_html ?? null,
      body_text: parsed.data.body_text ?? null,
      from_email: parsed.data.from_email ?? settings["marketing.from_email"] ?? null,
      from_name: parsed.data.from_name ?? settings["marketing.from_name"] ?? null,
      reply_to: parsed.data.reply_to ?? settings["marketing.reply_to"] ?? null,
      scheduled_at: parsed.data.scheduled_at ?? null,
      recurring_rule: parsed.data.recurring_rule ?? null,
      ghl_workflow_id: parsed.data.ghl_workflow_id ?? null,
      ghl_workflow_name: parsed.data.ghl_workflow_name ?? null,
      template_mode: parsed.data.template_mode ?? "plain",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single()

  if (dbError || !inserted) {
    return NextResponse.json({ error: dbError?.message ?? "Insert failed" }, { status: 500 })
  }

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "campaign.created",
    target_type: "campaign",
    target_id: inserted.id,
    meta: { type: parsed.data.type, scheduled: !!parsed.data.scheduled_at },
  })

  return NextResponse.json({ id: inserted.id })
}
