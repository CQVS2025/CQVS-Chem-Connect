/**
 * GoHighLevel webhook verification — two modes.
 *
 * 1. **Workflow trigger** webhooks (Email Event, Contact Created, etc.):
 *    GHL does not sign these. We use a shared-secret header configured
 *    inside each workflow's Custom Data:
 *       x-ghl-signature: <GHL_WEBHOOK_SECRET>
 *    Verified via `verifyGhlSignature`.
 *
 * 2. **Marketplace App** webhooks (LCEmailStats, OutboundMessage, etc.):
 *    GHL signs the raw body with their Ed25519 private key. We verify with
 *    their published public key. Verified via `verifyGhlEd25519`.
 */

import { createPublicKey, timingSafeEqual, verify } from "node:crypto"

import { GHL_CONFIG } from "./config"

export interface VerifyOptions {
  /** Raw request body as a string — kept for forward-compatibility with HMAC mode. */
  rawBody?: string
  /** Value of the signature / shared-token header. */
  signature: string | null
  /** Override secret (tests). */
  secret?: string
}

/**
 * Constant-time comparison of two strings of potentially different lengths.
 * Always hashes-to-same-length before comparing to avoid timing leaks.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  // timingSafeEqual requires equal-length buffers — pad via XOR with itself.
  if (aBuf.length !== bBuf.length) {
    // Still burn a timing-safe compare against a dummy so an attacker can't
    // distinguish "wrong length" from "wrong value" by timing.
    try {
      timingSafeEqual(aBuf, Buffer.alloc(aBuf.length))
    } catch {
      /* ignore */
    }
    return false
  }
  try {
    return timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

export function verifyGhlSignature({
  signature,
  secret = GHL_CONFIG.webhookSecret,
}: VerifyOptions): boolean {
  if (!signature || !secret) return false
  // Support optional "sha256=" / "Bearer " prefixes that some GHL configs attach.
  const received = signature.replace(/^sha256=|^Bearer\s+/i, "").trim()
  return constantTimeEquals(received, secret)
}

export function getSignatureHeader(req: Request): string | null {
  return (
    req.headers.get("x-ghl-signature") ??
    req.headers.get("x-wh-signature") ??
    req.headers.get("x-webhook-signature") ??
    req.headers.get("authorization")
  )
}

export interface VerifyEd25519Options {
  /** Raw request body as a string — signature is over the exact bytes GHL sent. */
  rawBody: string
  /** Base64-encoded signature from the X-GHL-Signature header. */
  signature: string | null
  /** Override PEM public key (tests). Defaults to GHL_WEBHOOK_PUBLIC_KEY env var. */
  publicKeyPem?: string
}

/**
 * Verify an LCEmailStats (or other Marketplace App) webhook using GHL's
 * Ed25519 public key. The public key is fixed across all GHL apps; they
 * publish it in their Webhook Integration Guide.
 *
 * Returns `{ ok: false, reason }` rather than throwing so the caller can
 * log the failure mode without unwinding the stack.
 */
export function verifyGhlEd25519({
  rawBody,
  signature,
  publicKeyPem = process.env.GHL_WEBHOOK_PUBLIC_KEY ?? "",
}: VerifyEd25519Options): { ok: boolean; reason?: string } {
  if (!signature || signature === "N/A") {
    return { ok: false, reason: "no signature" }
  }
  if (!publicKeyPem) {
    return { ok: false, reason: "GHL_WEBHOOK_PUBLIC_KEY not configured" }
  }
  try {
    const payloadBuffer = Buffer.from(rawBody, "utf8")
    const signatureBuffer = Buffer.from(signature, "base64")
    const key = createPublicKey(publicKeyPem)
    const ok = verify(null, payloadBuffer, key, signatureBuffer)
    return { ok, reason: ok ? undefined : "verify failed" }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}
