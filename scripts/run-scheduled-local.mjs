#!/usr/bin/env node
/**
 * Local helper — fires /api/marketing/campaigns/run-scheduled against the
 * dev server so scheduled campaigns actually dispatch during local testing.
 *
 * In production GitHub Actions calls the deployed URL every 5 minutes; locally
 * nothing does unless you run this script.
 *
 * Usage:
 *   npm run marketing:run-scheduled                # default localhost:3000
 *   npm run marketing:run-scheduled -- --url <url> # override target
 */

import { config } from "dotenv"
config({ path: ".env.local" })

const argv = process.argv.slice(2)
const urlIdx = argv.indexOf("--url")
const base =
  urlIdx !== -1 && argv[urlIdx + 1]
    ? argv[urlIdx + 1]
    : "http://localhost:3000"
const secret = process.env.MARKETING_CRON_SECRET

if (!secret) {
  console.error(
    "MARKETING_CRON_SECRET missing from .env.local — can't authenticate.",
  )
  process.exit(1)
}

const target = `${base.replace(/\/$/, "")}/api/marketing/campaigns/run-scheduled`
console.log(`→ POST ${target}`)

try {
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": secret,
    },
  })
  const bodyText = await response.text()
  console.log(`  status: ${response.status}`)
  console.log(`  body  : ${bodyText}`)
  if (!response.ok) process.exit(1)

  try {
    const body = JSON.parse(bodyText)
    const processed = body.processed ?? 0
    const failed = (body.results ?? []).filter((r) => r.error).length
    if (processed === 0) {
      console.log(
        "ℹ️  No due campaigns — nothing was scheduled before now, or everything already sent.",
      )
    } else {
      console.log(
        `✓ Processed ${processed} campaign(s), ${failed} failure(s). Check campaign detail pages for updated status.`,
      )
    }
  } catch {
    /* non-JSON body, ok */
  }
} catch (err) {
  console.error("✗ Unexpected error:", err?.message ?? err)
  process.exit(1)
}
