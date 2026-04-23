/**
 * GoHighLevel configuration constants.
 *
 * Values are read from `process.env` LAZILY (at call time, not at module
 * import time) so Node scripts that call `dotenv.config()` after importing
 * this module still work. Next.js loads `.env.local` before any module
 * evaluates, so it's always safe there.
 */

const DEFAULTS = {
  baseUrl: "https://services.leadconnectorhq.com",
  apiVersion: "2021-07-28",
  // Retry tuning
  maxRetries: 3,
  initialBackoffMs: 300,
  maxBackoffMs: 5000,
  // Pacing guard — pause briefly when remaining quota is low
  rateLimitPauseThreshold: 5,
  rateLimitPauseMs: 1000,
  // Hard request timeout — prevents a stuck GHL call from consuming the
  // whole Vercel serverless budget. Each individual attempt aborts at this.
  requestTimeoutMs: 20000,
} as const

/** Resolve the current config from env + defaults, validating required values. */
export function getGhlConfig() {
  const locationId = process.env.GHL_LOCATION_ID ?? ""
  const privateIntegrationToken = process.env.GHL_PRIVATE_INTEGRATION_TOKEN ?? ""
  const webhookSecret = process.env.GHL_WEBHOOK_SECRET ?? ""

  if (!locationId) {
    throw new Error(
      "GHL_LOCATION_ID is not set. Check .env.local for the CQVS sub-account ID.",
    )
  }
  if (!privateIntegrationToken) {
    throw new Error(
      "GHL_PRIVATE_INTEGRATION_TOKEN is not set. Check .env.local.",
    )
  }

  return {
    ...DEFAULTS,
    baseUrl: process.env.GHL_API_BASE_URL ?? DEFAULTS.baseUrl,
    apiVersion: process.env.GHL_API_VERSION ?? DEFAULTS.apiVersion,
    locationId,
    privateIntegrationToken,
    webhookSecret,
  }
}

/**
 * Read-only view used by non-critical code paths (e.g. webhook verification
 * that gracefully returns false when the secret is missing). For anything
 * that actually calls GHL, use `getGhlConfig()` which enforces required vars.
 */
export const GHL_CONFIG = {
  get baseUrl() {
    return process.env.GHL_API_BASE_URL ?? DEFAULTS.baseUrl
  },
  get apiVersion() {
    return process.env.GHL_API_VERSION ?? DEFAULTS.apiVersion
  },
  get locationId() {
    return process.env.GHL_LOCATION_ID ?? ""
  },
  get privateIntegrationToken() {
    return process.env.GHL_PRIVATE_INTEGRATION_TOKEN ?? ""
  },
  get webhookSecret() {
    return process.env.GHL_WEBHOOK_SECRET ?? ""
  },
  ...DEFAULTS,
} as const
