/**
 * Typed error classes for GHL API failures.
 *
 * Call sites can branch on error type to decide whether to retry, surface
 * to the user, or alert.
 */

export class GHLApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
    public endpoint?: string,
  ) {
    super(message)
    this.name = "GHLApiError"
  }
}

export class GHLRateLimitError extends GHLApiError {
  constructor(
    message: string,
    public retryAfterSeconds: number,
    body?: unknown,
    endpoint?: string,
  ) {
    super(429, message, body, endpoint)
    this.name = "GHLRateLimitError"
  }
}

export class GHLAuthError extends GHLApiError {
  constructor(message: string, body?: unknown, endpoint?: string) {
    super(401, message, body, endpoint)
    this.name = "GHLAuthError"
  }
}

export class GHLNotFoundError extends GHLApiError {
  constructor(message: string, body?: unknown, endpoint?: string) {
    super(404, message, body, endpoint)
    this.name = "GHLNotFoundError"
  }
}

/**
 * Should the caller retry after receiving this error?
 *
 * Retryable:
 * - 429 (rate limit — with Retry-After hint)
 * - 5xx (transient server error)
 * - Network-level failures (DNS, connection reset, socket timeout)
 * - AbortError from our own request-timeout AbortController
 *
 * Not retryable: 4xx (except 429), parse errors, programming errors.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof GHLRateLimitError) return true
  if (err instanceof GHLApiError) {
    return err.status >= 500 && err.status < 600
  }
  // Abort from our own timeout AbortController
  if (err instanceof Error && err.name === "AbortError") return true
  // TypeError is what undici/fetch throws on DNS / connection reset
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    if (
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("socket hang up")
    ) {
      return true
    }
  }
  return false
}
