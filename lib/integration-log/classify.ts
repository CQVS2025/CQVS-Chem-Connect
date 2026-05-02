/**
 * Map raw provider responses to (error_category, error_code) pairs.
 *
 * The classifier intentionally accepts whatever the wrapper has on hand
 * (status, parsed body, raw text, network exception) so call sites don't
 * have to reason about which fields exist for which provider.
 *
 * Categories are kept stable — see migration 050 for the documented set.
 */

export type ErrorCategory =
  | "auth"
  | "rate_limit"
  | "validation"
  | "business"
  | "carrier_config"
  | "network"
  | "server"
  | "unknown"

export interface ClassifiedError {
  category: ErrorCategory
  code: string
  message: string
}

/**
 * Network-level failure (no HTTP response received).
 *
 * Most common shape on Node's undici: `TypeError: fetch failed` with a
 * cause containing ENOTFOUND / ECONNREFUSED / EAI_AGAIN. The customer-facing
 * message stays generic; we just want a stable error_code for grouping.
 */
export function classifyNetworkError(err: unknown): ClassifiedError {
  const causeCode =
    err && typeof err === "object" && "cause" in err
      ? (err as { cause?: { code?: string; hostname?: string } }).cause
      : undefined
  const code = causeCode?.code
  const host = causeCode?.hostname

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return {
      category: "network",
      code: "NET_DNS",
      message: `DNS lookup failed${host ? ` for ${host}` : ""} (${code})`,
    }
  }
  if (code === "ECONNREFUSED") {
    return {
      category: "network",
      code: "NET_REFUSED",
      message: `Connection refused${host ? ` to ${host}` : ""}`,
    }
  }
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return {
      category: "network",
      code: "NET_TIMEOUT",
      message: `Connection timed out${host ? ` to ${host}` : ""}`,
    }
  }
  const baseMessage = err instanceof Error ? err.message : String(err)
  return {
    category: "network",
    code: "NET_FETCH_FAILED",
    message: baseMessage,
  }
}

// =====================================================================
// Xero
// =====================================================================

interface XeroBody {
  Type?: string | null
  Title?: string
  Status?: number
  Detail?: string
  Message?: string
  ErrorNumber?: number
  ValidationErrors?: Array<{ Message?: string }>
  Elements?: Array<{
    ValidationErrors?: Array<{ Message?: string }>
  }>
}

/**
 * Classify a non-2xx Xero response.
 *
 * Xero error bodies come in two shapes:
 *   1. Top-level { Title, Detail, Status }     — for OAuth/auth failures
 *   2. { Elements: [{ ValidationErrors }] }    — for validation on PUT/POST
 * We probe both.
 */
export function classifyXeroError(
  status: number,
  body: unknown,
  rawText: string | null,
): ClassifiedError {
  const obj = (typeof body === "object" && body !== null ? body : {}) as XeroBody

  // Pull a useful human message from whichever shape Xero used.
  const validation = collectValidationMessages(obj)
  const detail = obj.Detail || obj.Title || obj.Message || rawText || ""
  const message = validation || detail || `Xero responded with ${status}`

  // 401 / 403 ----------------------------------------------------------
  if (status === 401) {
    return { category: "auth", code: "AUTH_UNAUTHORIZED", message }
  }
  if (status === 403) {
    // Xero famously returns 403 with Title="Forbidden" Detail="AuthenticationUnsuccessful"
    // when the token works for another tenant but not this one, or when scopes
    // are missing. Treated as auth so it lands in the same admin alert bucket.
    if (/AuthenticationUnsuccessful/i.test(detail)) {
      return {
        category: "auth",
        code: "AUTH_UNSUCCESSFUL",
        message,
      }
    }
    return { category: "auth", code: "AUTH_FORBIDDEN", message }
  }

  // 429 ----------------------------------------------------------------
  if (status === 429) {
    return { category: "rate_limit", code: "RATE_LIMITED", message }
  }

  // 400 — almost always ValidationErrors -------------------------------
  if (status === 400) {
    // A few well-known specific cases worth surfacing as their own codes
    // because they need different operator action.
    if (/contact name/i.test(message) && /already assigned/i.test(message)) {
      return {
        category: "business",
        code: "CONTACT_NAME_DUP",
        message,
      }
    }
    if (/Unknown contact details/i.test(message)) {
      return {
        category: "business",
        code: "UNKNOWN_CONTACT",
        message,
      }
    }
    return { category: "validation", code: "VALIDATION_FAILED", message }
  }

  // 404 — usually means the entity doesn't exist OR the contact has no
  // EmailAddress when calling the /Email endpoints. We have to look at
  // the URL to disambiguate; the wrapper passes that in via `endpoint`
  // but here we only see the body. Caller handles the email-specific
  // hint; default code below covers the generic case.
  if (status === 404) {
    return { category: "business", code: "NOT_FOUND", message }
  }

  // 5xx ----------------------------------------------------------------
  if (status >= 500) {
    return { category: "server", code: `XERO_${status}`, message }
  }

  return { category: "unknown", code: `HTTP_${status}`, message }
}

/**
 * Specialized hint for the /PurchaseOrders/{id}/Email and
 * /Invoices/{id}/Email endpoints. Xero returns an empty 404 when the
 * contact has no EmailAddress — it's the most common operator-fixable
 * cause and worth its own code.
 */
export function classifyXeroEmailEndpoint404(
  rawText: string | null,
): ClassifiedError {
  return {
    category: "business",
    code: "PO_CONTACT_NO_EMAIL",
    message: `Xero email endpoint returned 404 (empty body). Most commonly: the supplier/customer contact has no email address on file. Raw: ${rawText ?? ""}`,
  }
}

function collectValidationMessages(obj: XeroBody): string {
  const messages: string[] = []
  if (Array.isArray(obj.ValidationErrors)) {
    for (const v of obj.ValidationErrors) {
      if (v.Message) messages.push(v.Message)
    }
  }
  if (Array.isArray(obj.Elements)) {
    for (const el of obj.Elements) {
      if (Array.isArray(el.ValidationErrors)) {
        for (const v of el.ValidationErrors) {
          if (v.Message) messages.push(v.Message)
        }
      }
    }
  }
  return messages.join("; ")
}

/**
 * Pull the rate-limit headers Xero exposes. We capture these on every
 * response (including success) so we can spot near-misses.
 */
export function extractXeroRateHeaders(
  headers: Headers,
): Record<string, string> {
  const out: Record<string, string> = {}
  const keys = [
    "x-appminlimit-remaining",
    "x-minlimit-remaining",
    "x-daylimit-remaining",
    "retry-after",
  ]
  for (const k of keys) {
    const v = headers.get(k)
    if (v != null) out[k] = v
  }
  return out
}

// =====================================================================
// Machship
// =====================================================================

interface MachshipErrorEntry {
  errorMessage?: string
  message?: string
  validationType?: string
  memberNames?: string[]
}

interface MachshipBody {
  errors?: MachshipErrorEntry[]
  object?: unknown
}

/**
 * Classify either:
 *   - a non-2xx Machship response (status >= 400), or
 *   - a 2xx response that nevertheless has errors[] populated. Machship
 *     does this for "soft" failures: the call worked, but the answer
 *     is "no, here's why" — most importantly for getRoutes when the
 *     account has no rate cards loaded for the lane.
 *
 * Pass `routesCount` so 200-OK-with-empty-routes can be distinguished
 * from a real 200-OK-with-routes; only the empty case is logged as an
 * issue.
 */
export function classifyMachshipResponse(args: {
  status: number
  body: unknown
  rawText: string | null
  routesCount?: number
}): ClassifiedError | null {
  const { status, body, rawText, routesCount } = args
  const obj = (typeof body === "object" && body !== null ? body : {}) as MachshipBody

  const errors = Array.isArray(obj.errors) ? obj.errors : []
  const messages = errors
    .map((e) => e.errorMessage ?? e.message ?? "")
    .filter(Boolean)
  const joined = messages.join("; ")

  // Network is handled separately; here we only see HTTP responses.

  if (status === 401) {
    // Always include the actionable hint. Without it admins see just
    // "Unauthorized" and don't know to check test/prod token mode.
    const detail = joined || rawText || ""
    const hint =
      "MachShip rejected the API token. Check MACSHIP_TOKEN and that test/prod mode matches the token type."
    return {
      category: "auth",
      code: "AUTH_TOKEN_INVALID",
      message: detail ? `${detail} - ${hint}` : hint,
    }
  }
  if (status === 403) {
    return {
      category: "auth",
      code: "AUTH_FORBIDDEN",
      message: joined || rawText || "MachShip 403 — token valid but not allowed.",
    }
  }
  if (status === 429) {
    return {
      category: "rate_limit",
      code: "RATE_LIMITED",
      message: joined || "MachShip rate limit hit",
    }
  }
  if (status >= 500) {
    return {
      category: "server",
      code: `MACSHIP_${status}`,
      message: joined || rawText || `MachShip responded with ${status}`,
    }
  }

  // 200 / 4xx with errors[] populated --------------------------------
  if (errors.length > 0 || (status >= 400 && status < 500)) {
    // Pattern-match the well-known business strings before falling back
    // to a generic VALIDATION_FAILED. This is what makes triage fast:
    // each code below maps to a specific operator action.
    if (/no carriers were configured/i.test(joined) ||
        /no routes were found using your carrier accounts/i.test(joined)) {
      return {
        category: "carrier_config",
        code: "NO_CARRIERS_ON_ACCOUNT",
        message:
          (joined || "MachShip account has no carriers configured for this lane.") +
          " - This is typically a MachShip-side configuration issue; contact MachShip support to enable carriers for this origin/destination.",
      }
    }
    if (/no prices were found/i.test(joined)) {
      return {
        category: "business",
        code: "NO_PRICES",
        message: joined,
      }
    }
    if (/no routes were found/i.test(joined)) {
      return {
        category: "business",
        code: "NO_ROUTES",
        message: joined,
      }
    }
    // Check the DG_MUST_BE_DECLARED ("you forgot the DG flag") case BEFORE
    // the DG_NOT_SUPPORTED ("DG declared on a non-DG route") case, because
    // both messages can contain "Dangerous Goods declared" and we want the
    // more specific match to win.
    if (/dangerous goods.*must be declared/i.test(joined)) {
      return {
        category: "business",
        code: "DG_MUST_BE_DECLARED",
        message: joined,
      }
    }
    if (
      /Route is not Dangerous Goods route/i.test(joined) ||
      /not.*Dangerous Goods route/i.test(joined) ||
      /Dangerous Goods have been declared/i.test(joined)
    ) {
      return {
        category: "business",
        code: "DG_NOT_SUPPORTED",
        message: joined,
      }
    }
    if (/Unable to find/i.test(joined) && /access/i.test(joined)) {
      return {
        category: "auth",
        code: "ACCESS_DENIED_ENTITY",
        message: joined,
      }
    }
    if (/Signature is required/i.test(joined)) {
      return {
        category: "validation",
        code: "PROFILE_INCOMPLETE",
        message: joined,
      }
    }
    if (/quantity is required/i.test(joined) || /must be greater than 0/i.test(joined)) {
      return {
        category: "validation",
        code: "INVALID_QUANTITY",
        message: joined,
      }
    }
    if (/email/i.test(joined) && /not.*valid/i.test(joined)) {
      return {
        category: "validation",
        code: "INVALID_EMAIL",
        message: joined,
      }
    }
    if (/postcode/i.test(joined) || /suburb/i.test(joined) || /location/i.test(joined)) {
      return {
        category: "validation",
        code: "INVALID_LOCATION",
        message: joined,
      }
    }

    if (status >= 400 && status < 500) {
      return {
        category: "validation",
        code: "VALIDATION_FAILED",
        message: joined || rawText || `MachShip responded with ${status}`,
      }
    }

    // 200 with errors[] but no recognized pattern.
    return {
      category: "business",
      code: "PROVIDER_REJECTED",
      message: joined,
    }
  }

  // 200 with no errors[] but zero routes — caller's call whether to log.
  if (routesCount === 0) {
    return {
      category: "business",
      code: "NO_ROUTES",
      message:
        "MachShip returned 200 with zero routes and no error messages. The lane may not be serviced or item dimensions may be out of range.",
    }
  }

  return null
}
