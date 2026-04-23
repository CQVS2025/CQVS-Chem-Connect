#!/usr/bin/env node
/**
 * Scheduled-campaign cron runner — invoked by GitHub Actions.
 *
 * Calls the deployed ChemConnect endpoint that finds and dispatches any
 * marketing_campaigns rows where status = 'scheduled' and scheduled_at <= now().
 *
 * Runtime: Node 20+ (ES modules). No TypeScript — no build step needed in CI.
 *
 * Environment variables:
 *   APP_URL                -- e.g. https://chem-connect.vercel.app
 *   MARKETING_CRON_SECRET  -- shared secret matching the one in the app's env
 */

const APP_URL = process.env.APP_URL
const CRON_SECRET = process.env.MARKETING_CRON_SECRET

if (!APP_URL) {
  console.error("Missing APP_URL")
  process.exit(1)
}
if (!CRON_SECRET) {
  console.error("Missing MARKETING_CRON_SECRET")
  process.exit(1)
}

const url = `${APP_URL.replace(/\/$/, "")}/api/marketing/campaigns/run-scheduled`

console.log(`→ POST ${url}`)

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": CRON_SECRET,
    },
  })

  const bodyText = await response.text()
  console.log(`  status: ${response.status}`)
  console.log(`  body  : ${bodyText}`)

  if (!response.ok) {
    console.error(`✗ Request failed (HTTP ${response.status})`)
    process.exit(1)
  }

  // Parse + summarise
  try {
    const body = JSON.parse(bodyText)
    const processed = body.processed ?? 0
    const failed = (body.results ?? []).filter((r) => r.error).length
    console.log(
      `✓ Run complete — processed ${processed} campaign(s), ${failed} failure(s)`,
    )
    if (failed > 0) {
      console.warn("Some campaigns failed; check the app's audit log for details.")
    }
  } catch {
    // Non-JSON response, still ok as long as the status was 2xx
  }
} catch (err) {
  console.error("✗ Unexpected error:", err?.message ?? err)
  process.exit(1)
}
