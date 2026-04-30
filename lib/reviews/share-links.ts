import { createHash, randomBytes } from "crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Helpers for the public review share-link feature (Phase 2).
 *
 *   - generateSlug()         - URL-safe random slug for new share links
 *   - validateShareLink()    - centralised page-load + submit-time check
 *   - hashIp()               - sha256 IP hash; the raw IP never persists
 *   - checkAndRecordIpRate() - per-IP rate limit (3 / hour by default)
 *
 * The submit endpoint and the public page both call validateShareLink
 * so the same rules (active / not expired / not over max-uses) are
 * enforced in both places.
 */

const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // skip 0/o/1/l/i - easier to read
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
export const RATE_LIMIT_MAX_ATTEMPTS = 3

/**
 * 9-char slug split with a dash for legibility ("xj8w-2k4f"). 31^9 entropy
 * is well over a trillion combinations - collisions are vanishingly rare,
 * but the DB unique constraint catches them anyway.
 */
export function generateSlug(): string {
  const buf = randomBytes(9)
  let raw = ""
  for (let i = 0; i < buf.length; i++) {
    raw += SLUG_ALPHABET[buf[i] % SLUG_ALPHABET.length]
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex")
}

/**
 * Pull the client IP out of the request headers. Trust order:
 *   1. x-forwarded-for (first IP in the list)
 *   2. x-real-ip
 *   3. cf-connecting-ip (Cloudflare)
 *   4. Fallback: '0.0.0.0' (rate-limit still works, just collapses
 *      everyone behind a single bucket - acceptable degradation)
 */
export function extractIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    "0.0.0.0"
  )
}

export type ShareLinkInvalidReason =
  | "not_found"
  | "revoked"
  | "expired"
  | "exhausted"

export interface ShareLinkRow {
  id: string
  slug: string
  product_id: string
  expires_at: string | null
  max_uses: number | null
  used_count: number
  is_active: boolean
}

/**
 * Look up a share link by slug and verify it's usable. Used by both the
 * page-load checker and the submit endpoint.
 */
export async function loadShareLinkBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<
  | { ok: true; link: ShareLinkRow }
  | { ok: false; reason: ShareLinkInvalidReason }
> {
  const { data, error } = await supabase
    .from("review_share_links")
    .select("id, slug, product_id, expires_at, max_uses, used_count, is_active")
    .eq("slug", slug)
    .maybeSingle()

  if (error || !data) return { ok: false, reason: "not_found" }
  const link = data as ShareLinkRow

  if (!link.is_active) return { ok: false, reason: "revoked" }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return { ok: false, reason: "expired" }
  }
  if (link.max_uses !== null && link.used_count >= link.max_uses) {
    return { ok: false, reason: "exhausted" }
  }

  return { ok: true, link }
}

/**
 * Per-IP rate-limit check + record. Records the attempt regardless of the
 * outcome of the rest of the submission - the attempt is the abuse signal
 * we care about.
 *
 * Returns true if within limit, false if 429-worthy.
 */
export async function checkAndRecordIpRate(
  supabase: SupabaseClient,
  ip: string,
  shareLinkId: string,
): Promise<{ withinLimit: boolean; attemptsInWindow: number }> {
  const ipHash = hashIp(ip)
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()

  const { count } = await supabase
    .from("review_share_submission_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since)

  const attemptsInWindow = count ?? 0
  // Always record this attempt - the abuse signal is the count itself.
  await supabase.from("review_share_submission_attempts").insert({
    ip_hash: ipHash,
    share_link_id: shareLinkId,
  })

  return {
    withinLimit: attemptsInWindow < RATE_LIMIT_MAX_ATTEMPTS,
    attemptsInWindow: attemptsInWindow + 1,
  }
}

/**
 * Build the absolute share URL for a slug. Uses NEXT_PUBLIC_SITE_URL when
 * set; falls back to NEXT_PUBLIC_APP_URL for local dev.
 */
export function buildShareUrl(slug: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://www.cqvs-chemconnect.com.au"
  return `${base.replace(/\/$/, "")}/reviews/share/${slug}`
}
