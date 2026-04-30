#!/usr/bin/env node
/**
 * Review-request cron runner — invoked by GitHub Actions daily.
 *
 * Calls /api/reviews/jobs/run which finds and dispatches any review_jobs
 * rows where status = 'pending' and send_at <= now().
 *
 * Runtime: Node 20+ (ES modules). Mirrors scripts/run-scheduled-campaigns.mjs.
 *
 * Environment variables:
 *   APP_URL                -- e.g. https://chem-connect.vercel.app
 *   MARKETING_CRON_SECRET  -- shared secret (same one used for marketing campaigns)
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

const url = `${APP_URL.replace(/\/$/, "")}/api/reviews/jobs/run`

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

  try {
    const body = JSON.parse(bodyText)
    console.log(
      `✓ Run complete — processed ${body.processed ?? 0}, sent ${body.sent ?? 0}, skipped ${body.skipped ?? 0}, failed ${body.failed ?? 0}`,
    )
    if (body.failed > 0) {
      console.warn("Some review jobs failed; check the app's audit log for details.")
    }
  } catch {
    // Non-JSON response — still ok if status was 2xx
  }
} catch (err) {
  console.error("✗ Unexpected error:", err?.message ?? err)
  process.exit(1)
}
