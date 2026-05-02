import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/admin/integration-logs
//
// Filterable view over integration_log for admin diagnostics.
//
// Query params (all optional, all combinable):
//   integration   xero | macship
//   status        success | error | warning
//   error_category  one of the categories from migration 050
//   correlation_id  exact uuid match
//   user_id         exact uuid match (the customer)
//   order_id        exact uuid match
//   q              free-text — substring match on endpoint, error_message,
//                   error_code (case-insensitive). Useful for "ORD-000094"
//                   or "no prices" lookups.
//   since           ISO timestamp; rows newer than this
//   limit           default 100, max 500
//
// Pagination is intentionally simple — admin only — sorted newest first.

const MAX_LIMIT = 500
const DEFAULT_LIMIT = 100

const VALID_INTEGRATIONS = new Set(["xero", "macship"])
const VALID_STATUSES = new Set(["success", "error", "warning"])
const VALID_CATEGORIES = new Set([
  "auth",
  "rate_limit",
  "validation",
  "business",
  "carrier_config",
  "network",
  "server",
  "unknown",
])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const url = request.nextUrl
  const integration = url.searchParams.get("integration")
  const status = url.searchParams.get("status")
  const errorCategory = url.searchParams.get("error_category")
  const correlationId = url.searchParams.get("correlation_id")
  const userId = url.searchParams.get("user_id")
  const orderId = url.searchParams.get("order_id")
  const q = url.searchParams.get("q")?.trim() ?? ""
  const since = url.searchParams.get("since")
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "", 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  let query = supabase
    .from("integration_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (integration && VALID_INTEGRATIONS.has(integration)) {
    query = query.eq("integration", integration)
  }
  if (status && VALID_STATUSES.has(status)) {
    query = query.eq("status", status)
  }
  if (errorCategory && VALID_CATEGORIES.has(errorCategory)) {
    query = query.eq("error_category", errorCategory)
  }
  if (correlationId && UUID_RE.test(correlationId)) {
    query = query.eq("correlation_id", correlationId)
  }
  if (userId && UUID_RE.test(userId)) {
    query = query.eq("user_id", userId)
  }
  if (orderId && UUID_RE.test(orderId)) {
    query = query.eq("order_id", orderId)
  }
  if (since) {
    query = query.gte("created_at", since)
  }
  if (q) {
    // The free-text search hits the three fields admins actually scan
    // when triaging. For more advanced needs, add a tsvector index later.
    const escaped = q.replace(/[%,]/g, (m) => `\\${m}`)
    query = query.or(
      [
        `endpoint.ilike.%${escaped}%`,
        `error_code.ilike.%${escaped}%`,
        `error_message.ilike.%${escaped}%`,
      ].join(","),
    )
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with friendly fields the admin UI uses up-top (order number,
  // customer name + email). We do this after the main query rather than
  // via Supabase's foreign-key embed because the joins are nullable and
  // we don't want any one missing FK to break the whole list. Two batched
  // SELECT-INs is fast and resilient.
  const rows = (data ?? []) as Array<{
    order_id: string | null
    user_id: string | null
    [key: string]: unknown
  }>

  const orderIds = [
    ...new Set(
      rows.map((r) => r.order_id).filter((v): v is string => Boolean(v)),
    ),
  ]
  const userIds = [
    ...new Set(
      rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)),
    ),
  ]

  const [ordersRes, profilesRes] = await Promise.all([
    orderIds.length > 0
      ? supabase
          .from("orders")
          .select("id, order_number, total")
          .in("id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, contact_name, company_name, email")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const orderById = new Map<string, { order_number: string; total: number | null }>()
  for (const o of (ordersRes.data ?? []) as Array<{
    id: string
    order_number: string
    total: number | null
  }>) {
    orderById.set(o.id, { order_number: o.order_number, total: o.total })
  }

  const profileById = new Map<
    string,
    { contact_name: string | null; company_name: string | null; email: string | null }
  >()
  for (const p of (profilesRes.data ?? []) as Array<{
    id: string
    contact_name: string | null
    company_name: string | null
    email: string | null
  }>) {
    profileById.set(p.id, {
      contact_name: p.contact_name,
      company_name: p.company_name,
      email: p.email,
    })
  }

  const enriched = rows.map((r) => {
    const order = r.order_id ? orderById.get(r.order_id) : undefined
    const profile = r.user_id ? profileById.get(r.user_id) : undefined
    return {
      ...r,
      // Friendly fields the UI displays up-top. All optional — the row
      // still renders if order/user lookups missed (e.g. a token-refresh
      // event has neither).
      order_number: order?.order_number ?? null,
      order_total: order?.total ?? null,
      customer_name:
        profile?.company_name?.trim() ||
        profile?.contact_name?.trim() ||
        null,
      customer_email: profile?.email ?? null,
    }
  })

  return NextResponse.json(enriched)
}
