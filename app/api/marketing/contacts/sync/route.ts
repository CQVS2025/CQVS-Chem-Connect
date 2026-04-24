/**
 * POST /api/marketing/contacts/sync
 *
 * Chunked re-sync of GHL contacts into the local mirror.
 *
 * Vercel Hobby has a hard 10s cap regardless of `maxDuration`, so the full
 * sync must be split across multiple requests. Each call fetches ONE GHL
 * page (up to 100 contacts), mirrors them in parallel (CONCURRENCY = 10),
 * and returns a cursor for the next page. The client loops until `done`.
 *
 * The sync is idempotent — mirrorGhlContact upserts by ghl_contact_id — so
 * if the browser tab closes mid-run, the next click just re-processes the
 * same contacts (cheap upserts). No state is persisted server-side.
 *
 * Request body (all optional; omitted on first call):
 *   {
 *     startAfter:        number    // cursor from previous response
 *     startAfterId:      string    // cursor from previous response
 *     totals:            { total, created, updated, failed }  // running totals
 *     session_started_at: number   // Date.now() at first call — for audit log
 *   }
 *
 * Response:
 *   {
 *     done:          boolean       // true when there's no next page
 *     startAfter:    number?       // pass back on next call if !done
 *     startAfterId:  string?       // pass back on next call if !done
 *     totals:        { total, created, updated, failed }  // cumulative
 *     ghlTotal:      number?       // GHL's reported total count (from meta.total)
 *     chunkDurationMs: number      // this call's wall time
 *   }
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"

// Hobby plan caps at 10s; we deliberately stay well under it per chunk.
export const maxDuration = 10

const PAGE_SIZE = 100
const CONCURRENCY = 10

interface SyncTotals {
  total: number
  created: number
  updated: number
  failed: number
}

interface SyncBody {
  startAfter?: number
  startAfterId?: string
  totals?: SyncTotals
  session_started_at?: number
}

export async function POST(request: NextRequest) {
  // Full re-sync is privileged (can cause write amplification against GHL).
  const { error, user } = await requireMarketingRole("settings")
  if (error) return error

  let body: SyncBody = {}
  try {
    const raw = await request.text()
    if (raw) body = JSON.parse(raw) as SyncBody
  } catch {
    // Empty body or malformed JSON — treat as first call.
  }

  const totals: SyncTotals = body.totals ?? {
    total: 0,
    created: 0,
    updated: 0,
    failed: 0,
  }
  const sessionStartedAt = body.session_started_at ?? Date.now()
  const chunkStartedAt = Date.now()

  const supabase = createServiceRoleClient()

  // Fetch one GHL page. GHL v2 uses startAfter (ms) + startAfterId as cursor.
  const page = await GhlContacts.listContacts({
    limit: PAGE_SIZE,
    startAfter: body.startAfter,
    startAfterId: body.startAfterId,
  })
  const contacts = page.contacts ?? []

  // Process in parallel batches. mirrorGhlContact is mostly I/O (Supabase
  // upserts + a few reads), so the concurrency buys most of the speedup.
  for (let i = 0; i < contacts.length; i += CONCURRENCY) {
    const batch = contacts.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (c) => {
        try {
          const r = await mirrorGhlContact(supabase, c, {
            source: "ghl_initial_sync",
          })
          return r.created ? "created" : "updated"
        } catch {
          return "failed"
        }
      }),
    )
    for (const r of results) {
      totals.total += 1
      if (r === "created") totals.created += 1
      else if (r === "updated") totals.updated += 1
      else totals.failed += 1
    }
  }

  // A short page means GHL has no more contacts after this cursor.
  const done = contacts.length < PAGE_SIZE
  let nextStartAfter: number | undefined
  let nextStartAfterId: string | undefined
  if (!done) {
    const last = contacts[contacts.length - 1]
    if (last?.dateAdded && last?.id) {
      nextStartAfter = new Date(last.dateAdded).getTime()
      nextStartAfterId = last.id
    } else {
      // Defensive: if GHL gave a full page but no cursor fields, bail out
      // cleanly rather than looping forever.
      return NextResponse.json({
        done: true,
        totals,
        chunkDurationMs: Date.now() - chunkStartedAt,
        warning: "no cursor on last contact; stopping early",
      })
    }
  }

  // Audit log only on the final call - one row per sync session, not per chunk.
  // Wrapped so an audit-log failure can never surface as "Sync failed" to the
  // user after the actual contact sync succeeded.
  if (done) {
    try {
      await supabase.from("marketing_audit_log").insert({
        actor_profile_id: user?.id ?? null,
        action: "contacts.force_resync",
        target_type: "marketing_contacts",
        meta: {
          ...totals,
          duration_ms: Date.now() - sessionStartedAt,
          chunked: true,
        },
      })
    } catch (err) {
      console.error("[contacts/sync] audit log insert failed:", err)
    }
  }

  return NextResponse.json({
    done,
    startAfter: nextStartAfter,
    startAfterId: nextStartAfterId,
    totals,
    ghlTotal: page.meta?.total,
    chunkDurationMs: Date.now() - chunkStartedAt,
  })
}
