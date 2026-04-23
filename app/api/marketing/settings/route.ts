/**
 * GET   /api/marketing/settings -- return all marketing.* keys + GHL connection status
 * PATCH /api/marketing/settings -- update one or more keys
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlLocations } from "@/lib/ghl"
import { sendMarketingAlert } from "@/lib/marketing/alerts"

const MARKETING_SETTING_KEYS = [
  "marketing.from_email",
  "marketing.from_name",
  "marketing.reply_to",
  "marketing.business_address",
  "marketing.business_name",
  "marketing.sending_domain",
  "marketing.ghl_location_id",
  "marketing.enabled",
  "marketing.sms_enabled",
  "marketing.sms_from_number",
] as const

type SettingKey = (typeof MARKETING_SETTING_KEYS)[number]

export async function GET() {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const supabase = createServiceRoleClient()
  const { data, error: dbError } = await supabase
    .from("admin_settings")
    .select("key, value, updated_at")
    .in("key", [...MARKETING_SETTING_KEYS])

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const settings: Record<string, string> = {}
  for (const row of data ?? []) {
    settings[row.key as string] = row.value as string
  }

  // GHL connection ping (non-blocking — if it fails we still return settings)
  let ghlStatus: "connected" | "error" | "unknown" = "unknown"
  let ghlLocation: { id: string; name: string } | undefined
  try {
    const loc = await GhlLocations.pingLocation()
    ghlStatus = "connected"
    ghlLocation = { id: loc.location.id, name: loc.location.name }
  } catch (err) {
    ghlStatus = "error"
    // Fire-and-forget alert email (throttled to one per 15 min by key).
    void sendMarketingAlert({
      key: "ghl.ping_failed",
      subject: "GoHighLevel connection check failed",
      body: `The Settings page ping to GHL just failed.\n\nError: ${
        err instanceof Error ? err.message : String(err)
      }\n\nCheck that GHL_PRIVATE_INTEGRATION_TOKEN is still valid and that the CQVS sub-account is reachable.`,
    })
  }

  return NextResponse.json({ settings, ghl: { status: ghlStatus, location: ghlLocation } })
}

const patchSchema = z.record(
  z.string(),
  z.string(),
)

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireMarketingRole("settings")
  if (error) return error

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

  const entries = Object.entries(parsed.data).filter(([key]) =>
    (MARKETING_SETTING_KEYS as readonly string[]).includes(key),
  )
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No recognised marketing settings in payload" },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  for (const [key, value] of entries) {
    const { error: dbError } = await supabase
      .from("admin_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() })
    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }
  }

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "settings.updated",
    target_type: "admin_settings",
    meta: { keys: entries.map(([k]) => k as SettingKey) },
  })

  return NextResponse.json({ ok: true, updated: entries.length })
}
