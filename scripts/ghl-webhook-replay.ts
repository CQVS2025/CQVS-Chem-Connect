/**
 * Replay a GHL-style webhook payload against the local dev server with the
 * configured shared-token signature header.
 *
 * Useful for:
 *   - Testing /api/webhooks/ghl/contacts without waiting for GHL to fire
 *   - Regression-testing the mirror logic against a captured payload
 *
 * Usage:
 *   npx tsx scripts/ghl-webhook-replay.ts \
 *     --path /api/webhooks/ghl/contacts \
 *     --file scripts/fixtures/ghl-contact-update.json \
 *     [--url http://localhost:3000] [--secret <override>]
 */

import { readFileSync } from "node:fs"
import { config } from "dotenv"

config({ path: ".env.local" })

interface ParsedArgs {
  path: string
  file: string
  url: string
  secret: string
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2)
  const get = (flag: string, fallback?: string): string => {
    const i = argv.indexOf(flag)
    if (i === -1) {
      if (fallback === undefined) {
        throw new Error(`Missing required flag: ${flag}`)
      }
      return fallback
    }
    const val = argv[i + 1]
    if (!val) throw new Error(`Flag ${flag} requires a value`)
    return val
  }
  return {
    path: get("--path"),
    file: get("--file"),
    url: get("--url", "http://localhost:3000"),
    secret: get("--secret", process.env.GHL_WEBHOOK_SECRET ?? ""),
  }
}

async function main() {
  const { path, file, url, secret } = parseArgs()

  if (!secret) {
    console.error(
      "No webhook secret available. Set GHL_WEBHOOK_SECRET in .env.local or pass --secret.",
    )
    process.exit(1)
  }

  const body = readFileSync(file, "utf8")

  const target = `${url.replace(/\/$/, "")}${path}`
  console.log(`→ POST ${target}`)
  console.log(`  signature: ${secret.slice(0, 8)}… (shared-token mode)`)

  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ghl-signature": secret,
    },
    body,
  })

  const text = await response.text()
  console.log(`  status  : ${response.status}`)
  console.log(`  body    : ${text}`)

  if (!response.ok) process.exit(1)
}

main().catch((err) => {
  console.error("Replay failed:", err)
  process.exit(1)
})
