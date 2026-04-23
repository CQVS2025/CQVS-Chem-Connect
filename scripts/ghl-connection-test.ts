/**
 * GoHighLevel connection test
 *
 * Verifies that GHL_PRIVATE_INTEGRATION_TOKEN + GHL_LOCATION_ID in .env.local
 * are valid by hitting a read-only endpoint (GET /locations/{id}) and printing
 * a short summary of the sub-account.
 *
 * Usage:
 *   npx tsx scripts/ghl-connection-test.ts
 */

import { config } from "dotenv"

config({ path: ".env.local" })

const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN
const locationId = process.env.GHL_LOCATION_ID
const baseUrl = process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com"
const apiVersion = process.env.GHL_API_VERSION ?? "2021-07-28"

if (!token || !locationId) {
  console.error("Missing env vars. Make sure .env.local has:")
  console.error("  GHL_PRIVATE_INTEGRATION_TOKEN")
  console.error("  GHL_LOCATION_ID")
  process.exit(1)
}

async function main() {
  const url = `${baseUrl}/locations/${locationId}`

  console.log(`→ GET ${url}`)

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: apiVersion,
      Accept: "application/json",
    },
  })

  const bodyText = await res.text()
  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    body = bodyText
  }

  if (!res.ok) {
    console.error(`✗ HTTP ${res.status} ${res.statusText}`)
    console.error(body)
    process.exit(1)
  }

  const loc = (body as { location?: Record<string, unknown> }).location ?? body
  const summary = loc as {
    id?: string
    name?: string
    companyId?: string
    email?: string
    phone?: string
    timezone?: string
    country?: string
  }

  console.log("✓ GHL connection successful\n")
  console.log("Sub-account:")
  console.log(`  id       : ${summary.id}`)
  console.log(`  name     : ${summary.name}`)
  console.log(`  company  : ${summary.companyId}`)
  console.log(`  email    : ${summary.email ?? "(not set)"}`)
  console.log(`  phone    : ${summary.phone ?? "(not set)"}`)
  console.log(`  timezone : ${summary.timezone ?? "(not set)"}`)
  console.log(`  country  : ${summary.country ?? "(not set)"}`)

  console.log("\nNext: pull a small batch of contacts to verify scopes.")
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err)
  process.exit(1)
})
