/**
 * POST /api/marketing/contacts/import
 *
 * Accepts an array of pre-mapped rows (the client-side wizard parses the
 * CSV, lets the admin map columns, then POSTs the clean rows here).
 *
 * Each row is upserted to GHL via contacts.upsert and mirrored locally.
 * Returns per-row results so the UI can show a success/failure summary
 * and let the admin download failed rows as a CSV.
 *
 * Row schema:
 *   {
 *     first_name?, last_name?, email?, phone?, company_name?, state?, tags?
 *   }
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"
import { normaliseAuPhone, normaliseEmail } from "@/lib/ghl/phone"

// Vercel Pro serverless timeout. At ~200ms per GHL upsert (with pacing) and
// the MAX_ROWS cap below, a batch finishes well inside the budget.
export const maxDuration = 60

/**
 * Max rows per import request. Serial GHL upserts with pacing finish roughly
 * 200 rows in 40-50 seconds — sits safely inside the 60s serverless budget
 * and avoids GHL's per-minute rate limits. Admin can re-upload for more.
 */
const MAX_ROWS_PER_REQUEST = 200

const rowSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(MAX_ROWS_PER_REQUEST),
  default_tags: z.array(z.string()).optional(),
})

interface RowResult {
  index: number
  status: "created" | "updated" | "skipped" | "failed"
  reason?: string
  ghlContactId?: string
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { rows, default_tags = [] } = parsed.data
  const supabase = createServiceRoleClient()
  const results: RowResult[] = []
  let created = 0
  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const email = normaliseEmail(row.email)
    const phone = normaliseAuPhone(row.phone)

    if (!email && !phone) {
      results.push({
        index: i,
        status: "skipped",
        reason: "Row has no valid email or phone",
      })
      skipped += 1
      continue
    }

    const mergedTags = Array.from(
      new Set([...(row.tags ?? []), ...default_tags].filter(Boolean)),
    )

    try {
      const upsert = await GhlContacts.upsertContact({
        email: email ?? undefined,
        phone: phone ?? undefined,
        firstName: row.first_name ?? undefined,
        lastName: row.last_name ?? undefined,
        companyName: row.company_name ?? undefined,
        state: row.state ?? undefined,
        tags: mergedTags.length > 0 ? mergedTags : undefined,
        source: "ChemConnect CSV Import",
      })

      await mirrorGhlContact(supabase, upsert.contact, {
        source: "csv_import",
      })

      if (upsert.new) {
        created += 1
        results.push({
          index: i,
          status: "created",
          ghlContactId: upsert.contact.id,
        })
      } else {
        updated += 1
        results.push({
          index: i,
          status: "updated",
          ghlContactId: upsert.contact.id,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failed += 1
      results.push({ index: i, status: "failed", reason: message })
    }
  }

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "contacts.imported",
    target_type: "marketing_contacts",
    meta: {
      total: rows.length,
      created,
      updated,
      skipped,
      failed,
      default_tags,
    },
  })

  return NextResponse.json({
    total: rows.length,
    created,
    updated,
    skipped,
    failed,
    results,
  })
}
