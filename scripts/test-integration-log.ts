/**
 * Integration-log self-tests.
 *
 * Run:  npx tsx scripts/test-integration-log.ts
 *
 * Exercises every classifier branch with payloads pulled from real
 * Xero/Machship documentation and reproduces the redaction behaviour
 * on representative bodies. No DB access — pure unit-level checks.
 *
 * Each `expect()` call prints a pass/fail line. Final summary shows
 * which tests caught regressions.
 */

import {
  classifyXeroError,
  classifyXeroEmailEndpoint404,
  classifyMachshipResponse,
  classifyNetworkError,
  extractXeroRateHeaders,
  redact,
  safeBody,
  runWithIntegrationContext,
  updateIntegrationContext,
  getIntegrationContext,
} from "../lib/integration-log"

let pass = 0
let fail = 0
const failures: string[] = []

function expect(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    failures.push(label)
    console.log(`  ✗ ${label}`)
    console.log(`     actual:   ${JSON.stringify(actual)}`)
    console.log(`     expected: ${JSON.stringify(expected)}`)
  }
}

function expectMatch(label: string, actual: unknown, regex: RegExp): void {
  const ok = typeof actual === "string" && regex.test(actual)
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    failures.push(label)
    console.log(`  ✗ ${label}  (no match for ${regex})`)
    console.log(`     actual: ${JSON.stringify(actual)}`)
  }
}

function section(name: string): void {
  console.log(`\n━━━ ${name} ━━━`)
}

// =====================================================================
// XERO error classification
// =====================================================================
section("Xero error classification")

// 1. Token expired / unauthorized
{
  const c = classifyXeroError(
    401,
    { Type: null, Title: "Unauthorized", Status: 401 },
    null,
  )
  expect("401 → AUTH_UNAUTHORIZED", c.code, "AUTH_UNAUTHORIZED")
  expect("401 → category=auth", c.category, "auth")
}

// 2. The famous 403 "AuthenticationUnsuccessful" — appeared 4× in user's logs
//    on 4/23. Caused by tenant mismatch / missing scope.
{
  const c = classifyXeroError(
    403,
    {
      Type: null,
      Title: "Forbidden",
      Status: 403,
      Detail: "AuthenticationUnsuccessful",
      Instance: "e82ac4eb-2b08-4d75-b612-f460ccabe4a8",
      Extensions: {},
    },
    null,
  )
  expect("403 + AuthenticationUnsuccessful → AUTH_UNSUCCESSFUL", c.code, "AUTH_UNSUCCESSFUL")
  expect("403 + AuthenticationUnsuccessful → category=auth", c.category, "auth")
}

// 3. 403 generic
{
  const c = classifyXeroError(403, { Title: "Forbidden", Status: 403 }, null)
  expect("403 generic → AUTH_FORBIDDEN", c.code, "AUTH_FORBIDDEN")
}

// 4. 429 rate limited
{
  const c = classifyXeroError(429, { Status: 429 }, null)
  expect("429 → RATE_LIMITED", c.code, "RATE_LIMITED")
  expect("429 → category=rate_limit", c.category, "rate_limit")
}

// 5. 400 with ValidationErrors (top-level)
{
  const c = classifyXeroError(
    400,
    {
      Status: 400,
      Type: "ValidationException",
      ValidationErrors: [{ Message: "Email Address must be valid" }],
    },
    null,
  )
  expect("400 ValidationErrors → VALIDATION_FAILED", c.code, "VALIDATION_FAILED")
  expectMatch("400 ValidationErrors → message contains text", c.message, /Email Address/)
}

// 6. 400 contact-name uniqueness — appeared in user's logs on 4/13
{
  const c = classifyXeroError(
    400,
    {
      Status: 400,
      Elements: [
        {
          ValidationErrors: [
            {
              Message:
                "The contact name Jonny Harper is already assigned to another contact. The contact name must be unique across all active contacts.",
            },
          ],
        },
      ],
    },
    null,
  )
  expect("400 contact-name dup → CONTACT_NAME_DUP", c.code, "CONTACT_NAME_DUP")
  expect("400 contact-name dup → category=business", c.category, "business")
}

// 7. 400 unknown contact details — also from user's logs
{
  const c = classifyXeroError(
    400,
    {
      Status: 400,
      ValidationErrors: [
        { Message: "Unknown contact details, please provide a valid ContactID or Contact Number" },
      ],
    },
    null,
  )
  expect("400 unknown contact → UNKNOWN_CONTACT", c.code, "UNKNOWN_CONTACT")
  expect("400 unknown contact → category=business", c.category, "business")
}

// 8. 500 server error (the Demo Company email-invoice case from logs)
{
  const c = classifyXeroError(
    500,
    {
      Title: "An error occurred",
      Detail: "An error occurred in Xero. Check the API Status page http://status.developer.xero.com for current service status.",
      Status: 500,
    },
    null,
  )
  expect("500 → XERO_500", c.code, "XERO_500")
  expect("500 → category=server", c.category, "server")
}

// 9. 404 generic
{
  const c = classifyXeroError(404, { Status: 404 }, null)
  expect("404 → NOT_FOUND", c.code, "NOT_FOUND")
}

// 10. 404 empty body on /Email endpoint — the warehouse-no-email case
{
  const c = classifyXeroEmailEndpoint404("")
  expect("404 empty /Email → PO_CONTACT_NO_EMAIL", c.code, "PO_CONTACT_NO_EMAIL")
  expect("404 empty /Email → category=business", c.category, "business")
  expectMatch("404 empty /Email → mentions no email", c.message, /no email/i)
}

// 11. Unknown status code falls back gracefully
{
  const c = classifyXeroError(418, {}, "I'm a teapot")
  expect("418 → category=unknown", c.category, "unknown")
  expect("418 → HTTP_418 code", c.code, "HTTP_418")
}

// =====================================================================
// XERO rate-limit headers
// =====================================================================
section("Xero rate-limit header extraction")

{
  // Reproduce a real Xero response Headers object.
  const h = new Headers({
    "X-MinLimit-Remaining": "57",
    "X-AppMinLimit-Remaining": "9998",
    "X-DayLimit-Remaining": "4982",
    "Retry-After": "30",
    "Content-Type": "application/json",
  })
  const out = extractXeroRateHeaders(h)
  expect(
    "all four rate headers extracted",
    Object.keys(out).sort(),
    [
      "retry-after",
      "x-appminlimit-remaining",
      "x-daylimit-remaining",
      "x-minlimit-remaining",
    ],
  )
  expect("Retry-After preserved", out["retry-after"], "30")
  expect("X-DayLimit-Remaining preserved", out["x-daylimit-remaining"], "4982")
}

{
  const h = new Headers({ "Content-Type": "application/json" })
  const out = extractXeroRateHeaders(h)
  expect("no rate headers → empty", out, {})
}

// =====================================================================
// MACHSHIP response classification
// =====================================================================
section("Machship response classification")

// 1. The prod incident — "no carriers on account" wording variant
{
  const c = classifyMachshipResponse({
    status: 200,
    body: {
      object: null,
      errors: [
        {
          validationType: "Error",
          memberNames: [],
          errorMessage: "No routes were found using your carrier accounts",
        },
      ],
    },
    rawText: "",
  })
  expect("no carriers on account → carrier_config", c?.category, "carrier_config")
  expect("no carriers on account → NO_CARRIERS_ON_ACCOUNT", c?.code, "NO_CARRIERS_ON_ACCOUNT")
  expectMatch("contains MachShip support hint", c?.message, /MachShip support/i)
}

// 2. "no carriers were configured" wording variant
{
  const c = classifyMachshipResponse({
    status: 200,
    body: {
      object: null,
      errors: [{ errorMessage: "No carriers were configured for this lane" }],
    },
    rawText: "",
  })
  expect("no carriers configured → NO_CARRIERS_ON_ACCOUNT", c?.code, "NO_CARRIERS_ON_ACCOUNT")
}

// 3. "No prices were found" — the consignment shape mismatch we just fixed
{
  const c = classifyMachshipResponse({
    status: 200,
    body: { object: null, errors: [{ errorMessage: "No prices were found." }] },
    rawText: "",
  })
  expect("no prices → NO_PRICES", c?.code, "NO_PRICES")
  expect("no prices → category=business", c?.category, "business")
}

// 4. DG mismatch — when DG declared but route doesn't support it
{
  const c = classifyMachshipResponse({
    status: 200,
    body: {
      object: null,
      errors: [
        {
          errorMessage:
            "Route is not Dangerous Goods route yet Dangerous Goods have been declared",
        },
      ],
    },
    rawText: "",
  })
  expect("DG-not-supported → DG_NOT_SUPPORTED", c?.code, "DG_NOT_SUPPORTED")
}

// 5. DG required-but-not-declared (the inverse)
{
  const c = classifyMachshipResponse({
    status: 200,
    body: {
      object: null,
      errors: [{ errorMessage: "Dangerous Goods must be declared on this route" }],
    },
    rawText: "",
  })
  expect("DG-must-be-declared → DG_MUST_BE_DECLARED", c?.code, "DG_MUST_BE_DECLARED")
}

// 6. Unknown contact details validation
{
  const c = classifyMachshipResponse({
    status: 422,
    body: {
      object: null,
      errors: [{ errorMessage: "Item quantity is required and must be greater than 0" }],
    },
    rawText: "",
  })
  expect("invalid qty → INVALID_QUANTITY", c?.code, "INVALID_QUANTITY")
  expect("invalid qty → category=validation", c?.category, "validation")
}

// 7. Postcode/suburb invalid (location)
{
  const c = classifyMachshipResponse({
    status: 422,
    body: {
      object: null,
      errors: [{ errorMessage: "Invalid suburb/postcode combination" }],
    },
    rawText: "",
  })
  expect("invalid location → INVALID_LOCATION", c?.code, "INVALID_LOCATION")
}

// 8. 401 token rejected
{
  const c = classifyMachshipResponse({
    status: 401,
    body: null,
    rawText: "Unauthorized",
  })
  expect("401 → AUTH_TOKEN_INVALID", c?.code, "AUTH_TOKEN_INVALID")
  expect("401 → category=auth", c?.category, "auth")
  expectMatch("401 hint about test/prod token", c?.message, /test\/prod/i)
}

// 9. 500 — Machship outage
{
  const c = classifyMachshipResponse({
    status: 500,
    body: { object: null, errors: [] },
    rawText: "Internal Server Error",
  })
  expect("500 → MACSHIP_500", c?.code, "MACSHIP_500")
  expect("500 → category=server", c?.category, "server")
}

// 10. 200 OK with routes but no errors[] — the happy path
{
  const c = classifyMachshipResponse({
    status: 200,
    body: { object: { id: "abc", routes: [{ carrier: { id: 628 } }] }, errors: [] },
    rawText: "",
    routesCount: 1,
  })
  expect("200 OK with routes → null (nothing to classify)", c, null)
}

// 11. 200 OK with empty routes and no errors — silent failure
{
  const c = classifyMachshipResponse({
    status: 200,
    body: { object: { id: "abc", routes: [] }, errors: [] },
    rawText: "",
    routesCount: 0,
  })
  expect("200 OK empty routes silent → NO_ROUTES", c?.code, "NO_ROUTES")
}

// =====================================================================
// NETWORK error classification
// =====================================================================
section("Network error classification")

{
  // Reproduce a real undici "fetch failed" error with cause from a DNS miss.
  const err = new TypeError("fetch failed")
  Object.assign(err, {
    cause: { code: "ENOTFOUND", hostname: "api.xero.com" },
  })
  const c = classifyNetworkError(err)
  expect("ENOTFOUND → NET_DNS", c.code, "NET_DNS")
  expectMatch("ENOTFOUND message names host", c.message, /api\.xero\.com/)
}

{
  const err = new TypeError("fetch failed")
  Object.assign(err, { cause: { code: "ECONNREFUSED", hostname: "api.machship.com" } })
  const c = classifyNetworkError(err)
  expect("ECONNREFUSED → NET_REFUSED", c.code, "NET_REFUSED")
}

{
  const err = new TypeError("fetch failed")
  Object.assign(err, { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } })
  const c = classifyNetworkError(err)
  expect("UND_ERR_CONNECT_TIMEOUT → NET_TIMEOUT", c.code, "NET_TIMEOUT")
}

{
  const err = new Error("Something else went wrong")
  const c = classifyNetworkError(err)
  expect("unknown network → NET_FETCH_FAILED", c.code, "NET_FETCH_FAILED")
}

// =====================================================================
// REDACTION
// =====================================================================
section("Redaction")

{
  const input = {
    foo: "bar",
    Authorization: "Bearer eyJabc.def.ghi",
    headers: {
      authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    },
    nested: {
      access_token: "xyz",
      refresh_token: "abc",
      something: { id_token: "deep" },
    },
  }
  const out = redact(input) as Record<string, unknown>
  expect("top-level Authorization redacted", out.Authorization, "[REDACTED]")
  expect(
    "nested authorization redacted",
    (out.headers as Record<string, string>).authorization,
    "[REDACTED]",
  )
  expect(
    "nested access_token redacted",
    (out.nested as Record<string, unknown>).access_token,
    "[REDACTED]",
  )
  expect(
    "deeply nested id_token redacted",
    ((out.nested as Record<string, unknown>).something as Record<string, unknown>).id_token,
    "[REDACTED]",
  )
  expect(
    "non-sensitive header preserved",
    (out.headers as Record<string, string>)["Content-Type"],
    "application/json",
  )
  expect("non-sensitive root field preserved", out.foo, "bar")
}

// Bearer-shaped string under a benign-looking key
{
  const input = { meta: "Bearer attacker-stuffed-this-here" }
  const out = redact(input) as Record<string, string>
  expect("Bearer-prefixed string redacted regardless of key", out.meta, "[REDACTED]")
}

// Stripe artefact
{
  const input = { payment_intent: "pi_abc123" }
  const out = redact(input) as Record<string, string>
  expect("payment_intent key redacted", out.payment_intent, "[REDACTED]")
}

// Arrays
{
  const input = { items: [{ password: "x" }, { name: "ok" }] }
  const out = redact(input) as { items: Array<Record<string, string>> }
  expect("password inside array element redacted", out.items[0].password, "[REDACTED]")
  expect("non-sensitive sibling preserved", out.items[1].name, "ok")
}

// Circular-ref / very deep — must not OOM
{
  type Node = { child?: Node; foo?: string }
  const root: Node = { foo: "ok" }
  let cur = root
  for (let i = 0; i < 30; i++) {
    cur.child = { foo: `level-${i}` }
    cur = cur.child
  }
  const out = redact(root)
  // Deep structure should be replaced by [TRUNCATED] at depth limit.
  let str = JSON.stringify(out)
  expectMatch("deep object truncated to avoid OOM", str, /\[TRUNCATED\]/)
}

// safeBody behaviour
{
  expect("safeBody null", safeBody(null), null)
  expect("safeBody empty", safeBody(""), null)
  expect("safeBody json parses", safeBody('{"x":1}'), { x: 1 })
  expect("safeBody non-json wraps as _raw", safeBody("nope"), { _raw: "nope" })
  const big = "a".repeat(40_000)
  const wrapped = safeBody(big) as { _truncated: boolean; _length: number }
  expect("safeBody truncates long bodies", wrapped._truncated, true)
  expect("safeBody records original length", wrapped._length, 40_000)
}

// =====================================================================
// ASYNC CONTEXT propagation
// =====================================================================
section("AsyncLocalStorage context propagation")

await runWithIntegrationContext(
  { correlationId: "test-corr", userId: "u1", metadata: { entry: "test" } },
  async () => {
    const ctx = getIntegrationContext()
    expect("correlation_id preserved", ctx?.correlationId, "test-corr")
    expect("user_id preserved", ctx?.userId, "u1")

    // Update from a downstream step
    updateIntegrationContext({ orderId: "o1", metadata: { foo: "bar" } })

    // Inside a deeply async chain — must still see the same context
    await Promise.resolve().then(async () => {
      await new Promise<void>((r) => setImmediate(r))
      const inner = getIntegrationContext()
      expect("context survives across awaits", inner?.correlationId, "test-corr")
      expect("downstream order_id visible", inner?.orderId, "o1")
      expect("merged metadata visible", inner?.metadata?.foo, "bar")
      expect("original metadata still there", inner?.metadata?.entry, "test")
    })
  },
)

// Outside any context, getIntegrationContext returns undefined.
expect("no context outside scope", getIntegrationContext(), undefined)

// =====================================================================
// SUMMARY
// =====================================================================
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`  Passed: ${pass}`)
console.log(`  Failed: ${fail}`)
if (fail > 0) {
  console.log(`\n  Failures:`)
  for (const f of failures) console.log(`    - ${f}`)
  process.exit(1)
}
console.log(`\n  All checks passed ✅`)
