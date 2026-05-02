#!/usr/bin/env node
/**
 * Delete GHL contacts listed in a CSV file.
 *
 * Reads a CSV produced by export-bounced-contacts.mjs (any CSV with an `id`
 * column will work) and calls DELETE /contacts/{id} for each row.
 *
 * SAFETY RAILS:
 *   - Dry-run by default. You MUST pass --confirm to actually delete.
 *   - Reads the CSV first and prints a count + first/last contact for sanity.
 *   - Logs every operation to scripts/output/delete-results-<timestamp>.csv
 *   - Rate-limits at 5 req/sec to stay under GHL's API quota.
 *
 * USAGE:
 *   # Dry run - shows what WOULD be deleted, makes no API calls
 *   node --env-file=.env.local scripts/delete-bounced-contacts.mjs \
 *     scripts/output/bounced-tier1-high-confidence.csv
 *
 *   # Actually delete - destructive, only run after dry-run looks right
 *   node --env-file=.env.local scripts/delete-bounced-contacts.mjs \
 *     scripts/output/bounced-tier1-high-confidence.csv --confirm
 *
 * OUTPUT:
 *   scripts/output/delete-results-<timestamp>.csv
 *     id, email, status (deleted | failed), httpStatus, error
 */

import fs from "node:fs/promises"
import path from "node:path"

const TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN
const BASE_URL =
  process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com"
const API_VERSION = process.env.GHL_API_VERSION || "2021-07-28"

if (!TOKEN || TOKEN.startsWith("pit-xxxxxxxx")) {
  console.error("Missing GHL_PRIVATE_INTEGRATION_TOKEN in environment.")
  process.exit(1)
}

const args = process.argv.slice(2)
const csvPath = args.find((a) => !a.startsWith("--"))
const confirmed = args.includes("--confirm")

if (!csvPath) {
  console.error("Usage: node scripts/delete-bounced-contacts.mjs <csv-path> [--confirm]")
  process.exit(1)
}

// ---------------------------------------------------------------------------
// CSV parsing - simple, only handles standard quoting
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { header: [], rows: [] }
  const header = splitCsvLine(lines[0])
  const rows = lines.slice(1).map(splitCsvLine)
  return { header, rows }
}

function splitCsvLine(line) {
  const out = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { cur += ch }
    } else {
      if (ch === ",") { out.push(cur); cur = "" }
      else if (ch === '"') { inQuotes = true }
      else { cur += ch }
    }
  }
  out.push(cur)
  return out
}

// ---------------------------------------------------------------------------
// Rate limiter - simple sleep between calls
// ---------------------------------------------------------------------------
const RATE_LIMIT_MS = 200 // 5 req/sec

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Delete one contact
// ---------------------------------------------------------------------------
async function deleteContact(id) {
  const url = `${BASE_URL}/contacts/${id}`
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: API_VERSION,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false, status: res.status, error: text.slice(0, 300) }
  }
  return { ok: true, status: res.status }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const fullPath = path.resolve(csvPath)
  console.log(`Reading: ${fullPath}`)

  const text = await fs.readFile(fullPath, "utf8")
  const { header, rows } = parseCsv(text)

  const idCol = header.indexOf("id")
  const emailCol = header.indexOf("email")
  const nameCol = header.indexOf("firstName")

  if (idCol === -1) {
    console.error(`CSV does not have an "id" column. Header: ${header.join(", ")}`)
    process.exit(1)
  }

  const validRows = rows.filter((r) => r[idCol] && r[idCol].trim().length > 0)

  console.log("")
  console.log("=".repeat(60))
  console.log(`Found ${validRows.length} contacts to delete`)
  if (validRows.length > 0) {
    const first = validRows[0]
    const last = validRows[validRows.length - 1]
    console.log("")
    console.log(`First: ${first[idCol]}  ${first[emailCol] ?? ""}  ${first[nameCol] ?? ""}`)
    console.log(`Last:  ${last[idCol]}  ${last[emailCol] ?? ""}  ${last[nameCol] ?? ""}`)
  }
  console.log("=".repeat(60))
  console.log("")

  if (!confirmed) {
    console.log("DRY RUN - no contacts have been deleted.")
    console.log("")
    console.log("To actually delete these contacts, re-run with --confirm:")
    console.log(`  node --env-file=.env.local scripts/delete-bounced-contacts.mjs \\`)
    console.log(`    ${csvPath} --confirm`)
    console.log("")
    return
  }

  // Final 5-second cooldown so an accidental --confirm can be cancelled
  console.log("LIVE RUN - will start deleting in 5 seconds. Press Ctrl+C to abort.")
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r  Starting in ${i}... `)
    await sleep(1000)
  }
  console.log("")
  console.log("")

  const results = []
  let succeeded = 0
  let failed = 0

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i]
    const id = row[idCol].trim()
    const email = (row[emailCol] ?? "").trim()
    const name = (row[nameCol] ?? "").trim()

    process.stdout.write(
      `  [${(i + 1).toString().padStart(3)}/${validRows.length}] ${id}  ${email}  `,
    )

    try {
      const r = await deleteContact(id)
      if (r.ok) {
        succeeded++
        process.stdout.write(`OK\n`)
        results.push({ id, email, status: "deleted", httpStatus: r.status, error: "" })
      } else {
        failed++
        process.stdout.write(`FAIL (${r.status})\n`)
        results.push({ id, email, status: "failed", httpStatus: r.status, error: r.error })
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      process.stdout.write(`ERROR: ${msg}\n`)
      results.push({ id, email, status: "failed", httpStatus: 0, error: msg })
    }

    await sleep(RATE_LIMIT_MS)
  }

  // Write results log
  const ts = new Date().toISOString().replace(/[:.]/g, "-")
  const resultsPath = path.resolve("scripts/output", `delete-results-${ts}.csv`)
  const csvOut = [
    "id,email,status,httpStatus,error",
    ...results.map(
      (r) =>
        `${r.id},${csvEscape(r.email)},${r.status},${r.httpStatus},${csvEscape(r.error)}`,
    ),
  ].join("\n")
  await fs.mkdir(path.dirname(resultsPath), { recursive: true })
  await fs.writeFile(resultsPath, csvOut + "\n", "utf8")

  console.log("")
  console.log("=".repeat(60))
  console.log(`Done. Deleted ${succeeded}, failed ${failed} of ${validRows.length}.`)
  console.log(`Log: ${resultsPath}`)
  console.log("=".repeat(60))

  if (failed > 0) process.exit(2)
}

function csvEscape(v) {
  if (v === null || v === undefined) return ""
  const s = String(v)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

main().catch((err) => {
  console.error("Failed:", err.message)
  process.exit(1)
})
