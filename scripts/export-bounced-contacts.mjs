#!/usr/bin/env node
/**
 * Export "likely bounced" GHL contacts, split into two confidence tiers.
 *
 * Tier 1 - HIGH confidence (safe to delete):
 *   - validEmail=false / emailValid=false (explicit invalid flag)
 *   - emailStatus = invalid / bounced / hard_bounce
 *   - emailLastBouncedAt / bounceType present (real bounce event logged)
 *
 * Tier 2 - MEDIUM confidence (review with client before deleting):
 *   - email DND set without any of the above. DND can mean "address bounced
 *     repeatedly so GHL auto-suppressed it" OR "user clicked unsubscribe".
 *     The two are indistinguishable from contact data alone, so the client
 *     decides per row.
 *
 * Run:
 *   node --env-file=.env.local scripts/export-bounced-contacts.mjs
 *
 * Output:
 *   scripts/output/bounced-tier1-high-confidence.csv  (safe to delete)
 *   scripts/output/bounced-tier2-needs-review.csv     (client decides)
 *   scripts/output/summary.txt                        (run summary)
 *   scripts/output/all-contacts-debug.json            (first 5 contacts'
 *                                                       full records)
 */

import fs from "node:fs/promises"
import path from "node:path"

const TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN
const LOCATION_ID = process.env.GHL_LOCATION_ID
const BASE_URL =
  process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com"
const API_VERSION = process.env.GHL_API_VERSION || "2021-07-28"

if (!TOKEN || TOKEN.startsWith("pit-xxxxxxxx")) {
  console.error("Missing GHL_PRIVATE_INTEGRATION_TOKEN in environment.")
  process.exit(1)
}
if (!LOCATION_ID) {
  console.error("Missing GHL_LOCATION_ID in environment.")
  process.exit(1)
}

const OUTPUT_DIR = path.resolve("scripts/output")
const TIER1_FILE = path.join(OUTPUT_DIR, "bounced-tier1-high-confidence.csv")
const TIER2_FILE = path.join(OUTPUT_DIR, "bounced-tier2-needs-review.csv")
const SUMMARY_FILE = path.join(OUTPUT_DIR, "summary.txt")
const DEBUG_FILE = path.join(OUTPUT_DIR, "all-contacts-debug.json")

const PAGE_SIZE = 100
const MAX_PAGES = 200

async function fetchContactsPage(page) {
  const url = `${BASE_URL}/contacts/search/`
  const body = {
    locationId: LOCATION_ID,
    page,
    pageLimit: PAGE_SIZE,
    sort: [{ field: "dateAdded", direction: "desc" }],
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GHL API ${res.status}: ${text.slice(0, 500)}`)
  }
  return res.json()
}

/**
 * Inspects a contact and returns:
 *   { tier: 1, reason: '...' }  - high-confidence bounce, safe to delete
 *   { tier: 2, reason: '...' }  - DND set, needs human review
 *   { tier: null }              - not flagged
 */
function classify(c) {
  // ---------- Tier 1: explicit invalid / bounce signals ----------

  if (c.validEmail === false) return { tier: 1, reason: "validEmail=false" }
  if (c.emailValid === false) return { tier: 1, reason: "emailValid=false" }

  const status =
    c.emailStatus ?? c.email_status ?? c.emailValidationStatus ?? null
  if (typeof status === "string") {
    const lower = status.toLowerCase()
    if (lower === "invalid" || lower === "bounced" || lower === "hard_bounce") {
      return { tier: 1, reason: `emailStatus=${status}` }
    }
  }

  if (c.emailLastBouncedAt || c.bouncedAt) {
    return { tier: 1, reason: "has bounce timestamp" }
  }
  if (c.emailBounceType || c.bounce_type || c.bounceType) {
    return { tier: 1, reason: "has bounce_type" }
  }

  // ---------- Tier 2: DND set (ambiguous - bounce or unsubscribe) ----------

  if (c.dnd === true) return { tier: 2, reason: "dnd=true (could be bounce or unsubscribe)" }
  if (c.emailDnd === true) return { tier: 2, reason: "emailDnd=true (could be bounce or unsubscribe)" }
  if (c.dndEmail === true) return { tier: 2, reason: "dndEmail=true (could be bounce or unsubscribe)" }

  if (c.dndSettings && typeof c.dndSettings === "object") {
    const ds = c.dndSettings
    if (ds.Email?.status === "active" || ds.email?.status === "active") {
      return {
        tier: 2,
        reason: "dndSettings.Email active (could be bounce or unsubscribe)",
      }
    }
  }

  return { tier: null }
}

function csvField(value) {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const HEADER = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "companyName",
  "dateAdded",
  "matchReason",
  "tags",
]
  .map(csvField)
  .join(",")

function contactToRow(c, reason) {
  const tags = Array.isArray(c.tags) ? c.tags.join("; ") : ""
  return [
    c.id ?? "",
    c.firstName ?? c.firstNameLowerCase ?? "",
    c.lastName ?? c.lastNameLowerCase ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.companyName ?? "",
    c.dateAdded ?? "",
    reason,
    tags,
  ]
    .map(csvField)
    .join(",")
}

async function main() {
  console.log(`Fetching all GHL contacts (location ${LOCATION_ID})...`)
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  const tier1Lines = [HEADER]
  const tier2Lines = [HEADER]
  const debugSample = []

  let totalScanned = 0
  let tier1Count = 0
  let tier2Count = 0

  // Track reason breakdown for the summary
  const reasonCounts = {}

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchContactsPage(page)
    const contacts = data.contacts ?? data.data ?? []
    if (contacts.length === 0) break

    totalScanned += contacts.length
    if (debugSample.length < 5) {
      debugSample.push(...contacts.slice(0, 5 - debugSample.length))
    }

    for (const c of contacts) {
      const result = classify(c)
      if (result.tier === 1) {
        tier1Lines.push(contactToRow(c, result.reason))
        tier1Count++
        reasonCounts[result.reason] = (reasonCounts[result.reason] ?? 0) + 1
      } else if (result.tier === 2) {
        tier2Lines.push(contactToRow(c, result.reason))
        tier2Count++
        reasonCounts[result.reason] = (reasonCounts[result.reason] ?? 0) + 1
      }
    }

    process.stdout.write(
      `  page ${page}: scanned ${contacts.length} (running totals: ${totalScanned} scanned, T1=${tier1Count}, T2=${tier2Count})\n`,
    )

    if (contacts.length < PAGE_SIZE) break
  }

  // Write the two CSVs
  await fs.writeFile(TIER1_FILE, tier1Lines.join("\n") + "\n", "utf8")
  await fs.writeFile(TIER2_FILE, tier2Lines.join("\n") + "\n", "utf8")
  await fs.writeFile(DEBUG_FILE, JSON.stringify(debugSample, null, 2), "utf8")

  // Build a human-readable summary
  const reasonLines = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `  ${count.toString().padStart(4)}  ${reason}`)
    .join("\n")

  const summary = [
    `GHL bounce export - run at ${new Date().toISOString()}`,
    `Location: ${LOCATION_ID}`,
    ``,
    `Total contacts scanned:  ${totalScanned}`,
    `Tier 1 (safe to delete): ${tier1Count}`,
    `Tier 2 (needs review):   ${tier2Count}`,
    `Total flagged:           ${tier1Count + tier2Count}`,
    ``,
    `Match reason breakdown:`,
    reasonLines || "  (none)",
    ``,
    `Output files:`,
    `  ${TIER1_FILE}`,
    `  ${TIER2_FILE}`,
    `  ${DEBUG_FILE}`,
    ``,
    `Send Tier 1 CSV to client with note: "These are confirmed bad addresses,`,
    `safe to delete or tag do_not_send."`,
    ``,
    `Send Tier 2 CSV to client with note: "These addresses have DND set - could`,
    `be bounces (auto-suppressed) OR contacts who unsubscribed legitimately.`,
    `Please review and flag any rows you'd like to keep before I delete them."`,
    ``,
  ].join("\n")

  await fs.writeFile(SUMMARY_FILE, summary, "utf8")

  console.log("")
  console.log("=".repeat(60))
  console.log(summary)
  console.log("=".repeat(60))
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
