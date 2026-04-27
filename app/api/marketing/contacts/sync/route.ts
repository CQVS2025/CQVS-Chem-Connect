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
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"
import { normaliseAuPhone, normaliseEmail } from "@/lib/ghl/phone"
import type { GhlContact } from "@/lib/ghl/types"

// Hobby plan caps at 10s; we deliberately stay well under it per chunk.
export const maxDuration = 10

const PAGE_SIZE = 100
const CONCURRENCY = 10

interface SyncTotals {
  total: number
  created: number
  updated: number
  failed: number
  purged: number
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
    purged: 0,
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

  // Batch legacy-claim: stamp any local row that has a matching email/phone
  // but NULL ghl_contact_id (typically CSV-imported or signup-created before
  // GHL was wired up) with the GHL id from this page. Without this, the
  // upsert below would insert a fresh row and we'd end up with a duplicate.
  // After the first run no NULL-id rows match, so this becomes two cheap
  // bulk SELECTs and short-circuits.
  await claimLegacyRows(supabase, contacts)

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

  // Final-chunk orphan purge: soft-delete any non-deleted contact whose
  // last_synced_at predates this session (or is null). Every contact mirrored
  // during the run gets last_synced_at = now() in mirrorGhlContact, so this
  // catches local rows that GHL no longer has.
  //
  // Guarded by `failed === 0` so a partial run (e.g. transient GHL errors on
  // some pages) doesn't wipe contacts that were simply skipped this round.
  if (done && totals.failed === 0) {
    try {
      const cutoffIso = new Date(sessionStartedAt).toISOString()
      const { data: purged, error: purgeError } = await supabase
        .from("marketing_contacts")
        .update({ deleted_at: new Date().toISOString() })
        .is("deleted_at", null)
        .or(`last_synced_at.is.null,last_synced_at.lt.${cutoffIso}`)
        .select("id")
      if (purgeError) {
        console.error("[contacts/sync] orphan purge failed:", purgeError)
      } else {
        totals.purged = purged?.length ?? 0
      }
    } catch (err) {
      console.error("[contacts/sync] orphan purge threw:", err)
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

/**
 * For each GHL contact in this chunk, find any local row with NULL
 * ghl_contact_id whose email/phone matches and stamp it with the GHL id
 * so the subsequent upsert updates that row instead of inserting a duplicate.
 *
 * Two bulk SELECTs (already-mirrored set, then legacy-row candidates) plus a
 * fanned-out parallel UPDATE per match. After the first successful sync, the
 * legacy SELECT returns nothing and the function short-circuits.
 */
async function claimLegacyRows(
  supabase: SupabaseClient,
  contacts: GhlContact[],
): Promise<void> {
  if (contacts.length === 0) return

  const chunkIds = contacts.map((c) => c.id).filter(Boolean)
  if (chunkIds.length === 0) return

  // Which of these GHL ids are already mirrored locally? Skip those —
  // re-stamping a legacy row to an id that's already taken would violate
  // the unique constraint.
  const { data: mirrored } = await supabase
    .from("marketing_contacts")
    .select("ghl_contact_id")
    .in("ghl_contact_id", chunkIds)
  const mirroredSet = new Set(
    (mirrored ?? [])
      .map((r) => r.ghl_contact_id as string | null)
      .filter((v): v is string => !!v),
  )

  const unmirrored = contacts.filter((c) => c.id && !mirroredSet.has(c.id))
  if (unmirrored.length === 0) return

  const emails = Array.from(
    new Set(
      unmirrored
        .map((c) => normaliseEmail(c.email))
        .filter((e): e is string => !!e),
    ),
  )
  const phones = Array.from(
    new Set(
      unmirrored
        .map((c) => normaliseAuPhone(c.phone))
        .filter((p): p is string => !!p),
    ),
  )
  if (emails.length === 0 && phones.length === 0) return

  // Pull every NULL-id row that matches by email or phone in one query each.
  const [{ data: byEmail }, { data: byPhone }] = await Promise.all([
    emails.length > 0
      ? supabase
          .from("marketing_contacts")
          .select("id, email, phone")
          .is("ghl_contact_id", null)
          .in("email", emails)
      : Promise.resolve({ data: [] as { id: string; email: string | null; phone: string | null }[] }),
    phones.length > 0
      ? supabase
          .from("marketing_contacts")
          .select("id, email, phone")
          .is("ghl_contact_id", null)
          .in("phone", phones)
      : Promise.resolve({ data: [] as { id: string; email: string | null; phone: string | null }[] }),
  ])

  const legacyById = new Map<string, { id: string; email: string | null; phone: string | null }>()
  for (const row of [...(byEmail ?? []), ...(byPhone ?? [])]) {
    legacyById.set(row.id, row)
  }
  if (legacyById.size === 0) return

  const emailIndex = new Map<string, string>() // email -> legacy id
  const phoneIndex = new Map<string, string>() // phone -> legacy id
  for (const row of legacyById.values()) {
    if (row.email) emailIndex.set(row.email.toLowerCase(), row.id)
    if (row.phone) phoneIndex.set(row.phone, row.id)
  }

  // Match each unmirrored GHL contact to one legacy row, ensuring no legacy
  // row is claimed twice in this chunk.
  const claims: Array<{ legacyId: string; ghlId: string }> = []
  const claimed = new Set<string>()
  for (const c of unmirrored) {
    const email = normaliseEmail(c.email)
    const phone = normaliseAuPhone(c.phone)
    let legacyId: string | undefined
    if (email) legacyId = emailIndex.get(email.toLowerCase())
    if (!legacyId && phone) legacyId = phoneIndex.get(phone)
    if (!legacyId || claimed.has(legacyId)) continue
    claims.push({ legacyId, ghlId: c.id })
    claimed.add(legacyId)
  }
  if (claims.length === 0) return

  await Promise.all(
    claims.map((c) =>
      supabase
        .from("marketing_contacts")
        .update({ ghl_contact_id: c.ghlId })
        .eq("id", c.legacyId),
    ),
  )
}
