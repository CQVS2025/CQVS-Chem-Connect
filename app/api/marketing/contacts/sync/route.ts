/**
 * POST /api/marketing/contacts/sync
 *
 * Runs a full re-pull of all contacts from GHL into the local mirror.
 * Idempotent — upserts by ghl_contact_id. Safe to call on demand from the
 * settings page when a drift is suspected.
 *
 * NOTE: For large contact lists (>1000) this may exceed even the 60s Vercel
 * Pro serverless timeout. Current list size (338) finishes in ~30s.
 * If the list grows large, move this to a Supabase Edge Function or a
 * background queue.
 */

import { NextResponse } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"

// Vercel Pro allows up to 300s on serverless functions. Pro is required.
export const maxDuration = 60

export async function POST() {
  // Force re-sync can cause GHL write amplification, restrict to admin tier.
  const { error, user } = await requireMarketingRole("settings")
  if (error) return error

  const supabase = createServiceRoleClient()

  let total = 0
  let created = 0
  let updated = 0
  let failed = 0
  const startedAt = Date.now()

  try {
    for await (const contact of GhlContacts.listAllContacts({ limit: 100 })) {
      total += 1
      try {
        const result = await mirrorGhlContact(supabase, contact, {
          source: "ghl_initial_sync",
        })
        if (result.created) created += 1
        else updated += 1
      } catch {
        failed += 1
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Sync failed: ${message}`, total, created, updated, failed },
      { status: 500 },
    )
  }

  const durationMs = Date.now() - startedAt
  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "contacts.force_resync",
    target_type: "marketing_contacts",
    meta: { total, created, updated, failed, duration_ms: durationMs },
  })

  return NextResponse.json({
    ok: true,
    total,
    created,
    updated,
    failed,
    durationMs,
  })
}
