/**
 * End-to-end smoke test for the integration_log wrappers.
 *
 * Run:  npx tsx scripts/test-integration-log-e2e.ts
 *
 * Strategy: intercept global fetch. Calls to api.xero.com / api.machship.com
 * get the canned response we want to test. Calls to the fake Supabase URL
 * are captured into a log so we can assert what would have been written
 * to integration_log.
 *
 * This exercises the real wrappers end-to-end, including AsyncLocalStorage
 * propagation and Supabase REST insert path (URL + JSON body shape).
 */

// Fake env so createServiceRoleClient() succeeds without a real cluster.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.local"
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key"
process.env.MACSHIP_MODE = "test"
process.env.MACSHIP_TEST_API_TOKEN = "fake-token"

interface CapturedSupabaseInsert {
  table: string
  rows: Array<Record<string, unknown>>
}

const supabaseInserts: CapturedSupabaseInsert[] = []

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>
let nextProviderHandler: FetchHandler | null = null

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()

  // Intercept Supabase REST inserts. Capture the row payload so the test
  // can verify what hit integration_log without a real database.
  if (url.startsWith("https://fake.supabase.local/")) {
    const tableMatch = url.match(/\/rest\/v1\/([^/?]+)/)
    const table = tableMatch?.[1] ?? "(unknown)"
    let rows: Array<Record<string, unknown>> = []
    if (init?.body) {
      try {
        const parsed = JSON.parse(init.body.toString())
        rows = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        rows = [{ _raw: init.body.toString() }]
      }
    }
    supabaseInserts.push({ table, rows })
    // Return a successful Postgrest response.
    return new Response("[]", {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Provider calls (Xero, Machship) get the canned response queued up.
  if (nextProviderHandler) {
    const handler = nextProviderHandler
    nextProviderHandler = null
    return handler(url, init)
  }

  // No mock set — fall back to real fetch (shouldn't happen in tests).
  return originalFetch(input, init)
}) as typeof globalThis.fetch

// Now import the real modules.
const { getXeroClient } = await import("../lib/xero/client")
const { getRoutes } = await import("../lib/macship/client")
const { runWithIntegrationContext } = await import("../lib/integration-log")

let pass = 0
let fail = 0
const failures: string[] = []

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    failures.push(label)
    console.log(`  ✗ ${label}`)
    if (detail) console.log(`     ${detail}`)
  }
}

function findIntegrationLogRow(
  predicate: (r: Record<string, unknown>) => boolean,
): Record<string, unknown> | undefined {
  for (const cap of supabaseInserts) {
    if (cap.table !== "integration_log") continue
    for (const r of cap.rows) {
      if (predicate(r)) return r
    }
  }
  return undefined
}

function clearCapture(): void {
  supabaseInserts.length = 0
}

function section(name: string): void {
  console.log(`\n━━━ ${name} ━━━`)
}

/**
 * Stub getActiveCredentials: it normally hits supabase to fetch xero
 * credentials. Our fake supabase URL would return [] (no row), which
 * would make getXeroClient() return null. We need a "row exists" path.
 *
 * Trick: each test's first supabase fetch is the credentials lookup;
 * intercept it here.
 */
let stubXeroCredentialsResponse: Record<string, unknown> | null = {
  id: "test-id",
  tenant_id: "test-tenant",
  tenant_name: "Test",
  access_token: "fake-access",
  refresh_token: "fake-refresh",
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  scope: "openid",
}

// Patch our supabase intercept to return the credentials when asked.
const originalIntercept = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()
  if (
    url.startsWith("https://fake.supabase.local/") &&
    url.includes("/xero_credentials") &&
    (init?.method === "GET" || !init?.method)
  ) {
    return new Response(
      stubXeroCredentialsResponse ? JSON.stringify([stubXeroCredentialsResponse]) : "[]",
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }
  return originalIntercept(input, init)
}) as typeof globalThis.fetch

// =====================================================================
// XERO — successful GET logs a success row
// =====================================================================
section("Xero: GET /Contacts success")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(JSON.stringify({ Contacts: [{ ContactID: "abc-123" }] }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-MinLimit-Remaining": "59",
        "X-DayLimit-Remaining": "4999",
      },
    })

  await runWithIntegrationContext(
    { correlationId: "test-corr-1", userId: "user-A", orderId: "order-A" },
    async () => {
      const xero = await getXeroClient()
      check("xero client constructed", !!xero)
      const result = await xero!.findContactByEmail("test@example.com")
      check("Xero findContactByEmail returns parsed contact", result?.ContactID === "abc-123")
    },
  )

  const row = findIntegrationLogRow(
    (r) => r.integration === "xero" && r.endpoint === "/Contacts",
  )
  check("logged a row for the Xero call", !!row)
  check("status=success", row?.status === "success", `got: ${row?.status}`)
  check("http_status=200", row?.http_status === 200)
  check("correlation_id propagated", row?.correlation_id === "test-corr-1")
  check("user_id propagated", row?.user_id === "user-A")
  check("order_id propagated", row?.order_id === "order-A")
  const headers = row?.response_headers as Record<string, string> | null
  check(
    "rate-limit headers captured",
    headers?.["x-minlimit-remaining"] === "59" &&
      headers?.["x-daylimit-remaining"] === "4999",
    JSON.stringify(headers),
  )
}

// =====================================================================
// XERO — 403 AuthenticationUnsuccessful
// =====================================================================
section("Xero: 403 AuthenticationUnsuccessful")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(
      JSON.stringify({
        Type: null,
        Title: "Forbidden",
        Status: 403,
        Detail: "AuthenticationUnsuccessful",
        Instance: "abc",
        Extensions: {},
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )

  await runWithIntegrationContext({ correlationId: "corr-403" }, async () => {
    const xero = await getXeroClient()
    let threw = false
    try {
      await xero!.createPurchaseOrder({
        Contact: { ContactID: "x" },
        LineItems: [],
        Date: "2026-05-02",
        Status: "AUTHORISED",
      })
    } catch {
      threw = true
    }
    check("createPurchaseOrder threw on 403", threw)
  })

  const row = findIntegrationLogRow(
    (r) =>
      r.integration === "xero" &&
      r.endpoint === "/PurchaseOrders" &&
      r.http_status === 403,
  )
  check("logged 403 row", !!row)
  check("status=error", row?.status === "error")
  check("error_code=AUTH_UNSUCCESSFUL", row?.error_code === "AUTH_UNSUCCESSFUL")
  check("error_category=auth", row?.error_category === "auth")
  check(
    "error_message contains AuthenticationUnsuccessful",
    typeof row?.error_message === "string" &&
      /AuthenticationUnsuccessful/.test(row.error_message as string),
  )
  // PUT /PurchaseOrders wraps as { PurchaseOrders: [input] }
  const reqPayload = row?.request_payload as
    | { PurchaseOrders?: Array<{ Contact?: { ContactID?: string } }> }
    | null
  check(
    "request_payload preserved (non-sensitive, wrapped)",
    reqPayload?.PurchaseOrders?.[0]?.Contact?.ContactID === "x",
  )
}

// =====================================================================
// XERO — record validation failed (200 with HasErrors=true)
// =====================================================================
section("Xero: 200 with HasErrors=true (record validation)")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(
      JSON.stringify({
        Contacts: [
          {
            ContactID: "00000000-0000-0000-0000-000000000000",
            HasErrors: true,
            ValidationErrors: [
              {
                Message:
                  "The contact name Jonny Harper is already assigned to another contact.",
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )

  await runWithIntegrationContext({ correlationId: "corr-rec-val" }, async () => {
    const xero = await getXeroClient()
    let threw = false
    try {
      await xero!.createContact({ Name: "Jonny Harper" })
    } catch {
      threw = true
    }
    check("createContact threw on record validation", threw)
  })

  const row = findIntegrationLogRow(
    (r) =>
      r.integration === "xero" &&
      r.error_code === "RECORD_VALIDATION_FAILED",
  )
  check("logged record-validation row", !!row)
  check("status=error", row?.status === "error")
  check(
    "message contains the validation text",
    typeof row?.error_message === "string" &&
      /already assigned/.test(row.error_message as string),
  )
}

// =====================================================================
// XERO — network failure (DNS)
// =====================================================================
section("Xero: network failure (ENOTFOUND)")
{
  clearCapture()
  nextProviderHandler = async () => {
    const err = new TypeError("fetch failed")
    Object.assign(err, {
      cause: { code: "ENOTFOUND", hostname: "api.xero.com" },
    })
    throw err
  }

  await runWithIntegrationContext({ correlationId: "corr-net" }, async () => {
    const xero = await getXeroClient()
    let threw = false
    try {
      await xero!.findContactByEmail("anyone@example.com")
    } catch {
      threw = true
    }
    check("findContactByEmail threw on DNS failure", threw)
  })

  const row = findIntegrationLogRow(
    (r) => r.integration === "xero" && r.http_status === 0,
  )
  check("logged network row with http_status=0", !!row)
  check("error_code=NET_DNS", row?.error_code === "NET_DNS")
  check("category=network", row?.error_category === "network")
}

// =====================================================================
// MACSHIP — 200 OK with errors[] (the prod-incident pattern)
// =====================================================================
section("Machship: 200 OK with errors[] (no carriers on account)")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(
      JSON.stringify({
        object: null,
        errors: [
          {
            validationType: "Error",
            memberNames: [],
            errorMessage: "No routes were found using your carrier accounts",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )

  await runWithIntegrationContext(
    {
      correlationId: "corr-machship",
      userId: "user-X",
      metadata: { delivery_postcode: "2000" },
    },
    async () => {
      let threw = false
      try {
        await getRoutes({
          companyId: 55514,
          despatchDateTimeLocal: "2026-05-02T08:00:00",
          fromLocation: { suburb: "West Ryde", postcode: "2114" },
          fromAddressLine1: "Test",
          fromName: "Test",
          toLocation: { suburb: "Sydney", postcode: "2000" },
          toName: "Customer",
          questionIds: [],
          items: [
            {
              itemType: 1,
              name: "X",
              quantity: 1,
              weight: 10,
              length: 10,
              width: 10,
              height: 10,
            },
          ],
        })
      } catch {
        threw = true
      }
      check("getRoutes threw because errors[] non-empty", threw)
    },
  )

  const row = findIntegrationLogRow(
    (r) => r.integration === "macship" && r.endpoint === "/apiv2/routes/returnroutes",
  )
  check("logged a Machship row", !!row)
  check("status=warning (200 OK with errors)", row?.status === "warning")
  check("http_status=200 preserved", row?.http_status === 200)
  check(
    "error_category=carrier_config",
    row?.error_category === "carrier_config",
    `got: ${row?.error_category}`,
  )
  check(
    "error_code=NO_CARRIERS_ON_ACCOUNT",
    row?.error_code === "NO_CARRIERS_ON_ACCOUNT",
  )
  check("correlation_id propagated", row?.correlation_id === "corr-machship")
  check("user_id propagated", row?.user_id === "user-X")
  const md = row?.metadata as Record<string, unknown> | null
  check("metadata.delivery_postcode preserved", md?.delivery_postcode === "2000")
}

// =====================================================================
// MACSHIP — happy path (200 OK with routes)
// =====================================================================
section("Machship: 200 OK with routes (success)")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(
      JSON.stringify({
        object: {
          id: "route-id",
          routes: [
            {
              carrier: { id: 628, name: "Aramex" },
              consignmentTotal: { totalSellPrice: 28.91 },
            },
          ],
        },
        errors: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )

  await runWithIntegrationContext({ correlationId: "corr-happy" }, async () => {
    const result = await getRoutes({
      companyId: 55514,
      despatchDateTimeLocal: "2026-05-02T08:00:00",
      fromLocation: { suburb: "West Ryde", postcode: "2114" },
      fromAddressLine1: "Test",
      fromName: "Test",
      toLocation: { suburb: "Sydney", postcode: "2000" },
      toName: "Customer",
      questionIds: [],
      items: [],
    })
    check("getRoutes returned route id", result.id === "route-id")
  })

  const row = findIntegrationLogRow(
    (r) => r.integration === "macship" && r.status === "success",
  )
  check("happy path logged a success row", !!row)
  const respObj = (row?.response_payload as {
    object?: { routes?: unknown[]; routesCount?: number }
  })?.object
  check("response summarised (routesCount populated)", respObj?.routesCount === 1)
  check(
    "response trimmed to first route only",
    Array.isArray(respObj?.routes) && respObj.routes.length === 1,
  )
}

// =====================================================================
// MACSHIP — 422 with errors[] (validation)
// =====================================================================
section("Machship: 422 with errors[] (validation)")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(
      JSON.stringify({
        object: null,
        errors: [
          { errorMessage: "Item quantity is required and must be greater than 0" },
        ],
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    )

  await runWithIntegrationContext({ correlationId: "corr-422" }, async () => {
    let threw = false
    try {
      await getRoutes({
        companyId: 55514,
        despatchDateTimeLocal: "2026-05-02T08:00:00",
        fromLocation: { suburb: "X", postcode: "2000" },
        fromAddressLine1: "Test",
        fromName: "Test",
        toLocation: { suburb: "Y", postcode: "2000" },
        toName: "Customer",
        questionIds: [],
        items: [],
      })
    } catch {
      threw = true
    }
    check("getRoutes threw on 422", threw)
  })

  const row = findIntegrationLogRow(
    (r) => r.integration === "macship" && r.http_status === 422,
  )
  check("logged 422 row", !!row)
  check("status=error", row?.status === "error")
  check("error_code=INVALID_QUANTITY", row?.error_code === "INVALID_QUANTITY")
  check("category=validation", row?.error_category === "validation")
}

// =====================================================================
// MACSHIP — 401 token rejected
// =====================================================================
section("Machship: 401 token rejected")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response("Unauthorized", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    })

  await runWithIntegrationContext({ correlationId: "corr-401" }, async () => {
    let threw = false
    try {
      await getRoutes({
        companyId: 55514,
        despatchDateTimeLocal: "2026-05-02T08:00:00",
        fromLocation: { suburb: "X", postcode: "2000" },
        fromAddressLine1: "Test",
        fromName: "Test",
        toLocation: { suburb: "Y", postcode: "2000" },
        toName: "Customer",
        questionIds: [],
        items: [],
      })
    } catch {
      threw = true
    }
    check("getRoutes threw on 401", threw)
  })

  const row = findIntegrationLogRow(
    (r) => r.integration === "macship" && r.http_status === 401,
  )
  check("logged 401 row", !!row)
  check("error_code=AUTH_TOKEN_INVALID", row?.error_code === "AUTH_TOKEN_INVALID")
  check(
    "message contains test/prod hint",
    typeof row?.error_message === "string" &&
      /test\/prod/i.test(row.error_message as string),
  )
}

// =====================================================================
// MACSHIP — 200 with empty routes & no errors[] (silent failure)
// =====================================================================
section("Machship: 200 OK empty routes, no errors[] (silent)")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(
      JSON.stringify({ object: { id: "rid", routes: [] }, errors: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )

  await runWithIntegrationContext({ correlationId: "corr-silent" }, async () => {
    const result = await getRoutes({
      companyId: 55514,
      despatchDateTimeLocal: "2026-05-02T08:00:00",
      fromLocation: { suburb: "X", postcode: "2000" },
      fromAddressLine1: "Test",
      fromName: "Test",
      toLocation: { suburb: "Y", postcode: "2000" },
      toName: "Customer",
      questionIds: [],
      items: [],
    })
    // Should NOT throw — silent zero-routes is a successful HTTP response.
    // The quote endpoint surfaces this as an event row separately.
    check("getRoutes did not throw on empty routes", Array.isArray(result.routes) && result.routes.length === 0)
  })

  // Wrapper still logs as success (HTTP layer succeeded). The "0 routes"
  // event row is the caller's responsibility — wrapped at a higher layer.
  const row = findIntegrationLogRow(
    (r) => r.integration === "macship" && r.status === "success",
  )
  check("wrapper logged success (zero-routes is caller's domain)", !!row)
}

// =====================================================================
// REDACTION verification — request payload with sensitive keys
// =====================================================================
section("End-to-end redaction in logged rows")
{
  clearCapture()
  nextProviderHandler = async () =>
    new Response(JSON.stringify({ Contacts: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  // Fake a request that *somehow* contains sensitive fields in the body
  // (defense-in-depth: we don't actually pass tokens this way, but if a
  // future caller did, redaction must catch it).
  await runWithIntegrationContext({ correlationId: "corr-redact" }, async () => {
    const xero = await getXeroClient()
    // Attach a sensitive-looking field via createContact's TaxNumber
    // for the test (TaxNumber isn't sensitive in reality; we'll add a
    // synthetic Authorization key via Object.assign for the test).
    type DummyContact = { Name: string; Authorization?: string }
    const c: DummyContact = { Name: "Test", Authorization: "Bearer leak-test" }
    try {
      await xero!.createContact(c as Parameters<typeof xero.createContact>[0])
    } catch {
      // ignore
    }
  })

  const row = findIntegrationLogRow(
    (r) => r.integration === "xero" && r.endpoint === "/Contacts",
  )
  check("logged contact-create row", !!row)
  const reqPayload = row?.request_payload as Record<string, unknown>
  // The single-record body shape:
  //   { Contacts: [{ Name: 'Test', Authorization: '[REDACTED]' }] }
  const contact = (reqPayload?.Contacts as Array<Record<string, unknown>>)?.[0]
  check(
    "Authorization in request body redacted",
    contact?.Authorization === "[REDACTED]",
    JSON.stringify(contact),
  )
  check("non-sensitive Name preserved", contact?.Name === "Test")
}

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
console.log(`\n  All e2e checks passed ✅`)
