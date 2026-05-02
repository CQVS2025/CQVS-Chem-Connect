/**
 * Redact secrets and obvious PII from request/response payloads before
 * they're written to integration_log.
 *
 * Conservative by design — we'd rather lose a debug breadcrumb than
 * persist an OAuth token to a log table. Anything that looks like a
 * credential gets replaced with the literal string "[REDACTED]".
 */

const SENSITIVE_KEY_PATTERNS = [
  /authorization/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /id[_-]?token/i,
  /client[_-]?secret/i,
  /api[_-]?key/i,
  /^token$/i,
  /password/i,
  /secret/i,
  // Stripe / payment artefacts — not provider-related but no reason to keep.
  /payment[_-]?intent/i,
  /client[_-]?secret/i,
  /card[_-]?number/i,
  /cvv|cvc/i,
]

export function redact<T>(value: T): T {
  return redactInner(value, 0) as T
}

function redactInner(value: unknown, depth: number): unknown {
  // Cap depth so a circular reference (or pathologically deep payload)
  // can't OOM the server.
  if (depth > 12) return "[TRUNCATED]"
  if (value == null) return value
  if (Array.isArray(value)) {
    return value.map((v) => redactInner(v, depth + 1))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERNS.some((re) => re.test(k))) {
        out[k] = "[REDACTED]"
      } else {
        out[k] = redactInner(v, depth + 1)
      }
    }
    return out
  }
  // Strings that LOOK like a JWT/Bearer token even when nested under a
  // benign-sounding key.
  if (typeof value === "string" && value.startsWith("Bearer ")) {
    return "[REDACTED]"
  }
  return value
}

/**
 * Best-effort safe stringify for things that shouldn't be jsonb (raw HTTP
 * bodies that turned out to be HTML error pages from a CDN, etc.).
 */
export function safeBody(text: string | null | undefined): unknown {
  if (text == null) return null
  if (text.length === 0) return null
  if (text.length > 32_000) {
    // Keep the head — that's where the useful content usually lives.
    return { _truncated: true, _length: text.length, head: text.slice(0, 32_000) }
  }
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text }
  }
}
