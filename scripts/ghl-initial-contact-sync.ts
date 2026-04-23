/**
 * One-shot initial sync of all GHL contacts into `marketing_contacts`.
 *
 * Run this once after applying migration 032_marketing_module.sql.
 * Safe to re-run — upserts are idempotent on `ghl_contact_id`.
 *
 * Usage:
 *   npx tsx scripts/ghl-initial-contact-sync.ts
 *
 * NOTE: dotenv MUST be loaded before any lib/ghl import — getGhlConfig()
 * reads process.env on first call, but some code paths (e.g. testing
 * imports) can cache values earlier. Safest pattern: dotenv first, libs
 * after via dynamic import.
 */

import { config } from "dotenv"
config({ path: ".env.local" })

// Dynamic imports AFTER dotenv so env vars are populated.
async function main() {
  const { GhlContacts } = await import("../lib/ghl")
  const { mirrorGhlContact } = await import("../lib/ghl/mirror")
  const { createClient } = await import("@supabase/supabase-js")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log("→ Starting initial GHL contact sync...")

  let total = 0
  let created = 0
  let updated = 0
  let failed = 0
  const startedAt = Date.now()

  for await (const contact of GhlContacts.listAllContacts({ limit: 100 })) {
    total += 1
    try {
      const result = await mirrorGhlContact(supabase, contact, {
        source: "ghl_initial_sync",
      })
      if (result.created) created += 1
      else updated += 1

      if (total % 50 === 0) {
        console.log(
          `  …${total} processed (created=${created}, updated=${updated}, failed=${failed})`,
        )
      }
    } catch (err) {
      failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ failed for ${contact.id} (${contact.email ?? "no email"}): ${msg}`)
    }
  }

  const durationMs = Date.now() - startedAt

  console.log("")
  console.log(`✓ Sync complete in ${(durationMs / 1000).toFixed(1)}s`)
  console.log(`  Total processed : ${total}`)
  console.log(`  Created         : ${created}`)
  console.log(`  Updated         : ${updated}`)
  console.log(`  Failed          : ${failed}`)

  // Audit log entry
  await supabase.from("marketing_audit_log").insert({
    action: "contacts.initial_sync",
    target_type: "marketing_contacts",
    meta: { total, created, updated, failed, duration_ms: durationMs },
  })
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err)
  process.exit(1)
})
