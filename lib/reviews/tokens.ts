import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Magic-link review tokens.
 *
 * Format on the wire (URL-safe base64): `<payload>.<signature>` where payload
 * is `<token_id>.<order_id>.<product_id>.<issued_at_unix>` and signature is
 * an HMAC-SHA256 over the payload using REVIEW_TOKEN_SIGNING_KEY.
 *
 * Storage: only the sha256 hash of the wire-format string lands in
 * review_tokens.token_hash. The raw token never touches the database, which
 * means a DB leak doesn't burn the signing channel.
 *
 * Validation enforces the four rules from the plan:
 *   1. Signature valid (HMAC + timing-safe compare)
 *   2. Not expired (60-day window from issued_at)
 *   3. Not consumed (one-use)
 *   4. Underlying order is in 'delivered' status (status gate)
 *
 * Rate limit (3 attempts / hour) is enforced at consume time by the caller —
 * see `recordAttempt()` and `assertWithinRateLimit()`.
 */

const TOKEN_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000 // 60 days
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 3

function getSigningKey(): string {
  const key = process.env.REVIEW_TOKEN_SIGNING_KEY
  if (!key || key.length < 32) {
    throw new Error(
      "REVIEW_TOKEN_SIGNING_KEY missing or too short (>=32 chars required)",
    )
  }
  return key
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/")
  const padLen = (4 - (padded.length % 4)) % 4
  return Buffer.from(padded + "=".repeat(padLen), "base64")
}

function sign(payload: string): string {
  const key = getSigningKey()
  const sig = createHmac("sha256", key).update(payload).digest()
  return base64UrlEncode(sig)
}

function hashForStorage(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export interface IssueTokenInput {
  orderId: string
  productId: string
}

export interface IssuedToken {
  /** The wire-format token to embed in the magic link. Hand to email only. */
  token: string
  /** Sha256 of the token, persisted to review_tokens.token_hash. */
  tokenHash: string
  /** UUID of the row inserted into review_tokens. */
  tokenId: string
  /** ISO timestamp when the token expires (issued_at + 60 days). */
  expiresAt: Date
}

/**
 * Generate a fresh signed token. Caller is responsible for inserting the
 * token_hash into review_tokens — this function is pure (no DB I/O).
 */
export function issueToken(input: IssueTokenInput): IssuedToken {
  const tokenId = randomBytes(16).toString("hex")
  const issuedAt = Date.now()
  const expiresAt = new Date(issuedAt + TOKEN_EXPIRY_MS)

  const payload = [tokenId, input.orderId, input.productId, issuedAt].join(".")
  const signature = sign(payload)
  const token = `${base64UrlEncode(Buffer.from(payload))}.${signature}`

  return {
    token,
    tokenHash: hashForStorage(token),
    tokenId,
    expiresAt,
  }
}

export interface DecodedToken {
  tokenId: string
  orderId: string
  productId: string
  issuedAt: number
}

/**
 * Verify the signature and decode payload. Does NOT check DB state — for
 * full validation including expiry / one-use / status-gate / rate-limit,
 * use validateAndConsumeToken() below.
 *
 * Returns null on any signature, format, or expiry failure (no detail —
 * we don't leak why a token is bad).
 */
export function verifyTokenSignature(token: string): DecodedToken | null {
  if (!token || typeof token !== "string") return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [payloadB64, providedSig] = parts

  let payload: string
  try {
    payload = base64UrlDecode(payloadB64).toString("utf8")
  } catch {
    return null
  }

  const expectedSig = sign(payload)
  const a = Buffer.from(providedSig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null
  }

  const fields = payload.split(".")
  if (fields.length !== 4) return null
  const [tokenId, orderId, productId, issuedAtStr] = fields
  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt)) return null

  // Wire-level expiry check (DB also stores expires_at as a belt-and-braces).
  if (Date.now() - issuedAt > TOKEN_EXPIRY_MS) return null

  return { tokenId, orderId, productId, issuedAt }
}

export interface ValidatedToken {
  tokenRowId: string
  orderId: string
  productId: string
}

export type ValidateError =
  | "invalid_signature"
  | "not_found"
  | "expired"
  | "already_used"
  | "rate_limited"
  | "order_not_delivered"
  | "reviews_disabled"

/**
 * Full validation against the DB:
 *   1. Signature OK
 *   2. token_hash exists in review_tokens
 *   3. expires_at > now()
 *   4. consumed_at is null
 *   5. attempt_count < 3 within the last hour (rate limit)
 *   6. underlying order.status = 'delivered'
 *   7. product.reviews_enabled = true
 *
 * On step 5 (rate limit) attempt_count is incremented even if subsequent
 * checks fail — that's the abuse signal we care about.
 */
export async function validateToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ ok: true; data: ValidatedToken } | { ok: false; error: ValidateError }> {
  const decoded = verifyTokenSignature(token)
  if (!decoded) return { ok: false, error: "invalid_signature" }

  const tokenHash = hashForStorage(token)
  const { data: row, error: rowErr } = await supabase
    .from("review_tokens")
    .select(
      "id, order_id, product_id, expires_at, consumed_at, attempt_count, last_attempt_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (rowErr || !row) return { ok: false, error: "not_found" }

  // Rate limit: count attempts in the last hour. Increment now so abusers
  // see the same response shape on every hit and don't get useful timing
  // data from the per-check branches.
  const now = new Date()
  const lastAttemptAt = row.last_attempt_at ? new Date(row.last_attempt_at) : null
  const withinWindow =
    lastAttemptAt && now.getTime() - lastAttemptAt.getTime() < RATE_LIMIT_WINDOW_MS
  const newAttemptCount = withinWindow ? row.attempt_count + 1 : 1
  await supabase
    .from("review_tokens")
    .update({ attempt_count: newAttemptCount, last_attempt_at: now.toISOString() })
    .eq("id", row.id)

  if (newAttemptCount > RATE_LIMIT_MAX_ATTEMPTS) {
    return { ok: false, error: "rate_limited" }
  }

  if (new Date(row.expires_at) <= now) return { ok: false, error: "expired" }
  if (row.consumed_at) return { ok: false, error: "already_used" }

  // Order status gate
  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", row.order_id)
    .maybeSingle()
  if (!order || order.status !== "delivered") {
    return { ok: false, error: "order_not_delivered" }
  }

  // Product opt-out gate
  const { data: product } = await supabase
    .from("products")
    .select("reviews_enabled")
    .eq("id", row.product_id)
    .maybeSingle()
  if (!product || product.reviews_enabled === false) {
    return { ok: false, error: "reviews_disabled" }
  }

  return {
    ok: true,
    data: { tokenRowId: row.id, orderId: row.order_id, productId: row.product_id },
  }
}

/**
 * Mark a token as consumed. Called atomically with the review insert by the
 * submit route — caller wraps both in a single supabase.rpc transaction or
 * accepts the small window of race risk (one-use enforcement is best-effort
 * given Postgres without explicit transaction support in supabase-js).
 */
export async function consumeToken(
  supabase: SupabaseClient,
  tokenRowId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("review_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", tokenRowId)
    .is("consumed_at", null)
  return !error
}
