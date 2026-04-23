/**
 * GoHighLevel API base client.
 *
 * All GHL REST calls funnel through this single `ghlFetch()` helper:
 * - Injects Authorization + Version headers
 * - Hard timeout per attempt (prevents stuck requests from burning serverless budget)
 * - Retries on 429, 5xx, and transient network errors with exponential backoff
 * - Surfaces typed errors for 4xx (so callers can branch on auth vs 404 vs other)
 * - Honours rate-limit hints from X-RateLimit-Remaining
 */

import { getGhlConfig } from "./config"
import {
  GHLApiError,
  GHLAuthError,
  GHLNotFoundError,
  GHLRateLimitError,
  isRetryableError,
} from "./errors"

export interface GhlFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  // Override defaults — rarely needed
  token?: string
  locationId?: string
  version?: string
  signal?: AbortSignal
  timeoutMs?: number
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: GhlFetchOptions["query"],
): string {
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Compose our timeout AbortController with any signal the caller passed.
 * If either fires, the fetch aborts.
 */
function composeSignals(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let abortHandler: (() => void) | undefined
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort()
    } else {
      abortHandler = () => controller.abort()
      callerSignal.addEventListener("abort", abortHandler, { once: true })
    }
  }

  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timeoutId)
      if (callerSignal && abortHandler) {
        callerSignal.removeEventListener("abort", abortHandler)
      }
    },
  }
}

export async function ghlFetch<T>(
  path: string,
  options: GhlFetchOptions = {},
): Promise<T> {
  const config = getGhlConfig()
  const token = options.token ?? config.privateIntegrationToken
  const version = options.version ?? config.apiVersion
  const timeoutMs = options.timeoutMs ?? config.requestTimeoutMs

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Version: version,
    Accept: "application/json",
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const url = buildUrl(config.baseUrl, path, options.query)
  const method = options.method ?? "GET"

  let attempt = 0
  let lastError: unknown

  while (attempt <= config.maxRetries) {
    const { signal, cancel } = composeSignals(timeoutMs, options.signal)
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal,
      })

      // Pacing guard for subsequent calls
      const remaining = response.headers.get("X-RateLimit-Remaining")
      if (remaining && Number(remaining) <= config.rateLimitPauseThreshold) {
        await sleep(config.rateLimitPauseMs)
      }

      const text = await response.text()
      let parsed: unknown
      if (text) {
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = text
        }
      }

      cancel()

      if (response.ok) {
        return parsed as T
      }

      if (response.status === 401 || response.status === 403) {
        throw new GHLAuthError(
          extractMessage(parsed, "GHL authentication failed"),
          parsed,
          path,
        )
      }
      if (response.status === 404) {
        throw new GHLNotFoundError(
          extractMessage(parsed, "GHL resource not found"),
          parsed,
          path,
        )
      }
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 2)
        throw new GHLRateLimitError(
          extractMessage(parsed, "GHL rate limit exceeded"),
          retryAfter,
          parsed,
          path,
        )
      }
      throw new GHLApiError(
        response.status,
        extractMessage(
          parsed,
          `GHL API error (${response.status} ${response.statusText})`,
        ),
        parsed,
        path,
      )
    } catch (err) {
      cancel()
      lastError = err
      if (!isRetryableError(err) || attempt === config.maxRetries) {
        throw err
      }
      const retryAfter =
        err instanceof GHLRateLimitError ? err.retryAfterSeconds * 1000 : 0
      const backoff = Math.min(
        config.maxBackoffMs,
        Math.max(
          retryAfter,
          config.initialBackoffMs * Math.pow(3, attempt),
        ),
      )
      await sleep(backoff)
      attempt += 1
    }
  }

  throw lastError
}

function extractMessage(body: unknown, fallback: string): string {
  if (!body) return fallback
  if (typeof body === "string") return body
  if (typeof body === "object" && body !== null) {
    const b = body as { message?: string; error?: string }
    if (typeof b.message === "string") return b.message
    if (typeof b.error === "string") return b.error
  }
  return fallback
}
