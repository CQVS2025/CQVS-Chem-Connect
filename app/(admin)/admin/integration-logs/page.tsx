"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wifi,
  Server,
  X,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { get } from "@/lib/api/client"

// Row shape from the integration_log table; only fields we actually render.
interface LogRow {
  id: string
  integration: "xero" | "macship"
  endpoint: string
  method: string
  http_status: number
  duration_ms: number | null
  status: "success" | "error" | "warning"
  error_category: string | null
  error_code: string | null
  error_message: string | null
  correlation_id: string | null
  user_id: string | null
  order_id: string | null
  entity_type: string | null
  entity_id: string | null
  xero_id: string | null
  action: string | null
  request_payload: unknown
  response_payload: unknown
  response_headers: Record<string, string> | null
  metadata: Record<string, unknown> | null
  created_at: string
  // Server-enriched fields — added by the API (left-join to orders +
  // profiles). All optional: a token-refresh row has none, a quote from
  // an anonymous shopper has only customer_email.
  order_number: string | null
  order_total: number | null
  customer_name: string | null
  customer_email: string | null
}

interface StatsResponse {
  since: string
  byIntegration: Record<string, { total: number; errors: number }>
  byCategory: Record<string, number>
}

// Tones use Tailwind's `<color>-x dark:<color>-x` pairs so they read well
// in both modes. Borders are tinted with low alpha so they don't compete
// with the surface; foreground colors stay strong enough to be legible.
const CATEGORY_LABELS: Record<string, { label: string; tone: string; Icon: typeof Activity }> = {
  auth: {
    label: "Auth",
    tone: "border-rose-500/40 text-rose-600 dark:text-rose-400",
    Icon: ShieldAlert,
  },
  rate_limit: {
    label: "Rate limit",
    tone: "border-amber-500/40 text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  validation: {
    label: "Validation",
    tone: "border-orange-500/40 text-orange-700 dark:text-orange-400",
    Icon: AlertTriangle,
  },
  business: {
    label: "Business",
    tone: "border-yellow-500/40 text-yellow-700 dark:text-yellow-400",
    Icon: AlertTriangle,
  },
  carrier_config: {
    label: "Carrier config",
    tone: "border-purple-500/40 text-purple-700 dark:text-purple-400",
    Icon: ShieldAlert,
  },
  network: {
    label: "Network",
    tone: "border-blue-500/40 text-blue-600 dark:text-blue-400",
    Icon: Wifi,
  },
  server: {
    label: "Server",
    tone: "border-red-500/40 text-red-700 dark:text-red-400",
    Icon: Server,
  },
  unknown: {
    label: "Unknown",
    tone: "border-border text-muted-foreground",
    Icon: AlertTriangle,
  },
}

export default function IntegrationLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Filters (client-side state; pushed into the API on each load).
  const [integration, setIntegration] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [errorCategory, setErrorCategory] = useState<string>("all")
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [correlationId, setCorrelationId] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (integration !== "all") params.set("integration", integration)
    if (status !== "all") params.set("status", status)
    if (errorCategory !== "all") params.set("error_category", errorCategory)
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim())
    if (correlationId.trim()) params.set("correlation_id", correlationId.trim())
    params.set("limit", "200")
    return params.toString()
  }, [integration, status, errorCategory, debouncedQ, correlationId])

  const hasActiveFilters =
    integration !== "all" ||
    status !== "all" ||
    errorCategory !== "all" ||
    debouncedQ.trim().length > 0 ||
    correlationId.trim().length > 0

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true)
    else setRefreshing(true)
    try {
      // Paths are relative — the api/client helper auto-prepends /api.
      const [data, statsData] = await Promise.all([
        get<LogRow[]>(`/admin/integration-logs?${queryString}`),
        get<StatsResponse>(`/admin/integration-logs/stats`),
      ])
      setRows(data)
      setStats(statsData)
    } catch (err) {
      console.error("Failed to load integration logs:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const totalErrors24h = stats
    ? (stats.byIntegration.xero?.errors ?? 0) +
      (stats.byIntegration.macship?.errors ?? 0)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Integration Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Every Xero and MacShip API call, with full request/response and customer-journey linking.
          Use this to diagnose checkout, invoice, or PO failures.
        </p>
      </div>

      {/* Stats: 24h failure summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last 24 hours</CardDescription>
              <CardTitle className="text-2xl">
                {(stats.byIntegration.xero?.total ?? 0) +
                  (stats.byIntegration.macship?.total ?? 0)} calls
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Xero: {stats.byIntegration.xero?.total ?? 0} ·
              MacShip: {stats.byIntegration.macship?.total ?? 0}
            </CardContent>
          </Card>
          <Card
            className={
              totalErrors24h && totalErrors24h > 0 ? "border-destructive/40" : ""
            }
          >
            <CardHeader className="pb-2">
              <CardDescription>Errors (24h)</CardDescription>
              <CardTitle
                className={`text-2xl ${
                  totalErrors24h && totalErrors24h > 0 ? "text-destructive" : ""
                }`}
              >
                {totalErrors24h ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Xero: {stats.byIntegration.xero?.errors ?? 0} ·
              MacShip: {stats.byIntegration.macship?.errors ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>By category (24h)</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {Object.keys(stats.byCategory).length === 0 ? (
                <span className="text-sm text-muted-foreground">No errors</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => {
                      const meta = CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.unknown
                      return (
                        <Badge
                          key={cat}
                          variant="outline"
                          className={`gap-1 ${meta.tone}`}
                        >
                          <meta.Icon className="h-3 w-3" />
                          {meta.label} · {count}
                        </Badge>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Select value={integration} onValueChange={setIntegration}>
            <SelectTrigger>
              <SelectValue placeholder="Integration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All integrations</SelectItem>
              <SelectItem value="xero">Xero</SelectItem>
              <SelectItem value="macship">MacShip</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={errorCategory} onValueChange={setErrorCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Error category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, m]) => (
                <SelectItem key={k} value={k}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search endpoint, code, message..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Input
            placeholder="Correlation ID (uuid)"
            value={correlationId}
            onChange={(e) => setCorrelationId(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Rows */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">
              {hasActiveFilters ? "Filtered calls" : "Recent calls"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {rows.length} {rows.length === 1 ? "row" : "rows"}
              </span>
            </CardTitle>
            <CardDescription>
              {hasActiveFilters
                ? "Filtered view — clear the filters below to see everything."
                : "Newest first · max 200 rows"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Active filter chips — without these, "Show only this journey"
              is invisible because the user can't tell anything changed. */}
          {hasActiveFilters && (
            <ActiveFilterBar
              integration={integration}
              status={status}
              errorCategory={errorCategory}
              q={debouncedQ}
              correlationId={correlationId}
              onClearIntegration={() => setIntegration("all")}
              onClearStatus={() => setStatus("all")}
              onClearErrorCategory={() => setErrorCategory("all")}
              onClearQ={() => setQ("")}
              onClearCorrelationId={() => setCorrelationId("")}
              onClearAll={() => {
                setIntegration("all")
                setStatus("all")
                setErrorCategory("all")
                setQ("")
                setCorrelationId("")
              }}
            />
          )}

          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No log entries match these filters.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <LogRowItem
                  key={row.id}
                  row={row}
                  expanded={!!expanded[row.id]}
                  onToggle={() => toggleExpand(row.id)}
                  onCorrelationClick={(id) => {
                    setCorrelationId(id)
                    // Scroll to top so the user sees the filter bar light up.
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActiveFilterBar({
  integration,
  status,
  errorCategory,
  q,
  correlationId,
  onClearIntegration,
  onClearStatus,
  onClearErrorCategory,
  onClearQ,
  onClearCorrelationId,
  onClearAll,
}: {
  integration: string
  status: string
  errorCategory: string
  q: string
  correlationId: string
  onClearIntegration: () => void
  onClearStatus: () => void
  onClearErrorCategory: () => void
  onClearQ: () => void
  onClearCorrelationId: () => void
  onClearAll: () => void
}) {
  const chips: Array<{ label: string; onClear: () => void }> = []
  if (integration !== "all")
    chips.push({ label: `Integration: ${integration}`, onClear: onClearIntegration })
  if (status !== "all")
    chips.push({ label: `Status: ${status}`, onClear: onClearStatus })
  if (errorCategory !== "all") {
    const meta = CATEGORY_LABELS[errorCategory]
    chips.push({
      label: `Category: ${meta?.label ?? errorCategory}`,
      onClear: onClearErrorCategory,
    })
  }
  if (q) chips.push({ label: `Search: "${q}"`, onClear: onClearQ })
  if (correlationId) {
    chips.push({
      label: `Customer journey: ${correlationId.slice(0, 8)}…`,
      onClear: onClearCorrelationId,
    })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
      <span className="text-muted-foreground font-medium">Active filters:</span>
      {chips.map((c) => (
        <Badge
          key={c.label}
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-1"
        >
          {c.label}
          <button
            type="button"
            onClick={c.onClear}
            className="ml-1 rounded hover:bg-foreground/10 p-0.5"
            aria-label={`Clear ${c.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-auto text-muted-foreground hover:text-foreground underline decoration-dotted"
      >
        Clear all
      </button>
    </div>
  )
}

/**
 * Translate a raw endpoint path or event-action into a sentence an admin
 * can read at a glance. Falls back to the raw value if we don't recognise
 * it — which is the safe default for new endpoints we haven't mapped yet.
 */
function humanizeAction(row: LogRow): string {
  // Event rows carry an `action` like "send", "create", "quote.success".
  // Combine with entity_type for context (e.g. "purchase_order_email send"
  // → "Sent purchase-order email").
  if (row.method === "EVENT") {
    const a = (row.action ?? "").toLowerCase()
    const e = (row.entity_type ?? "").toLowerCase()

    // Xero workflow events
    if (e === "purchase_order_email" && a === "send") return "Sent PO email to warehouse"
    if (e === "invoice_email" && a === "send") return "Sent invoice email to customer"
    if (e === "invoice" && a === "create") return "Created invoice in Xero"
    if (e === "purchase_order" && a === "create") return "Created PO in Xero"
    if (e === "purchase_order" && a === "approve") return "Approved PO in Xero"
    if (e === "contact" && a === "sync") return "Synced contact to Xero"
    if (e === "invoice_attachment" && a === "attach") return "Attached PO PDF to invoice"
    if (e === "connection" && a === "connect") return "Connected to Xero"
    if (e === "connection" && a === "disconnect") return "Disconnected from Xero"
    if (e === "connection" && a === "token_refresh") return "Refreshed Xero token"
    if (a === "token_refresh") return "Refreshed Xero token"

    // MacShip events
    if (a === "quote.success") return "Got shipping quote (MacShip)"
    if (a === "quote.zero_routes") return "Shipping quote returned no carriers"
    if (a === "quote.warehouse_select_failed") return "Couldn't pick a warehouse"
    if (a === "quote.unhandled_error") return "Shipping quote crashed"

    return a || e || "Workflow event"
  }

  // HTTP rows — translate the endpoint path.
  const path = row.endpoint
  if (row.integration === "xero") {
    if (/^\/Contacts$/.test(path) && row.method === "GET") return "Looked up Xero contact"
    if (/^\/Contacts$/.test(path) && row.method === "POST") return "Updated Xero contact"
    if (/^\/Contacts$/.test(path) && row.method === "PUT") return "Created Xero contact"
    if (/^\/Invoices$/.test(path)) return "Created invoice in Xero"
    if (/^\/Invoices\/[^/]+\/Email$/.test(path)) return "Asked Xero to email the invoice"
    if (/^\/Invoices\/[^/]+\/Attachments\//.test(path)) return "Attached file to Xero invoice"
    if (/^\/PurchaseOrders$/.test(path)) return "Created PO in Xero"
    if (/^\/PurchaseOrders\/[^/]+\/Email$/.test(path)) return "Asked Xero to email the PO"
  }
  if (row.integration === "macship") {
    if (path.endsWith("/routes/returnroutes")) return "Got shipping quote (MacShip)"
    if (path.endsWith("/consignments/createConsignment")) return "Booked consignment with MacShip"
    if (path.includes("/consignments/manifest")) return "Manifested consignment(s)"
    if (path.includes("/consignments/dispatch")) return "Dispatched consignment(s)"
    if (path.includes("/getUnmanifestedConsignmentForEdit"))
      return "Loaded consignment for edit (MacShip)"
    if (path.includes("/editUnmanifestedConsignment"))
      return "Updated consignment despatch date (MacShip)"
  }

  return `${row.method} ${path}`
}

/**
 * One-line description of *who* this row was about — order + customer.
 * Returns null when there's nothing meaningful (token refresh, etc.) so
 * the UI can skip the line entirely.
 */
function humanizeContext(row: LogRow): string | null {
  const bits: string[] = []
  if (row.order_number) bits.push(row.order_number)
  if (row.customer_name) bits.push(row.customer_name)
  else if (row.customer_email) bits.push(row.customer_email)
  return bits.length ? bits.join(" — ") : null
}

function LogRowItem({
  row,
  expanded,
  onToggle,
  onCorrelationClick,
}: {
  row: LogRow
  expanded: boolean
  onToggle: () => void
  onCorrelationClick: (id: string) => void
}) {
  const isError = row.status === "error"
  const isWarning = row.status === "warning"
  // Theme-aware backgrounds. We use the destructive token for errors, an
  // amber tint for warnings (so it reads as "non-fatal" not "dead"), and
  // the muted/card surface for success rows so the page isn't a wall of
  // green checkmarks.
  const tone = isError
    ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
    : isWarning
      ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
      : "border-border hover:bg-muted/40"

  const cat = row.error_category
    ? CATEGORY_LABELS[row.error_category] ?? CATEGORY_LABELS.unknown
    : null

  // EVENT rows aren't HTTP calls — http_status=0 there is meaningless, so
  // hide the status badge entirely. Real network failures (also http=0
  // but method !== EVENT) keep showing "no-response" so admins can spot
  // DNS / fetch failures at a glance.
  const isEventRow = row.method === "EVENT"
  const showStatusBadge = !isEventRow || row.http_status > 0

  // The whole row is interactive (click to expand). We render it as a
  // <div role="button"> rather than a real <button> because we have a
  // nested correlation-id button inside the header, and <button> inside
  // <button> is invalid HTML / triggers a hydration error in React.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onToggle()
    }
  }

  const headline = humanizeAction(row)
  const context = humanizeContext(row)

  return (
    <div className={`rounded-md border ${tone} text-sm transition-colors`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="w-full cursor-pointer px-3 py-2 flex items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
      >
        <div className="pt-0.5 shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* Headline row: human-readable summary + status badge */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase">
              {row.integration}
            </Badge>
            <span className="font-medium truncate">{headline}</span>
            {showStatusBadge && (
              <Badge
                variant={isError ? "destructive" : isWarning ? "secondary" : "outline"}
                className="ml-auto"
              >
                {row.status === "success" ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <AlertTriangle className="h-3 w-3 mr-1" />
                )}
                {row.http_status === 0 ? "no-response" : row.http_status}
              </Badge>
            )}
            {row.duration_ms !== null && (
              <span className="text-xs text-muted-foreground">
                {row.duration_ms} ms
              </span>
            )}
          </div>

          {/* Context line: who/which order this was about */}
          {context && (
            <div className="mt-1 text-xs">
              <span className="text-muted-foreground">For: </span>
              <span className="font-medium">{context}</span>
              {row.customer_email && row.customer_name && (
                <span className="text-muted-foreground">
                  {" "}
                  · {row.customer_email}
                </span>
              )}
            </div>
          )}

          {/* Meta line: time, category, correlation chip */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{new Date(row.created_at).toLocaleString()}</span>
            {cat && (
              <Badge variant="outline" className={`gap-1 ${cat.tone}`}>
                <cat.Icon className="h-3 w-3" />
                {cat.label}
              </Badge>
            )}
            {row.correlation_id && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCorrelationClick(row.correlation_id!)
                }}
                className="text-xs underline decoration-dotted text-primary hover:opacity-80"
                title="Filter the list to every Xero/MacShip call from this same customer flow"
              >
                Show only this journey →
              </button>
            )}
          </div>

          {/* Error message — full sentence, not truncated, since it's
              what the admin actually needs to read on a failure */}
          {row.error_message && (
            <p className="mt-1.5 text-xs text-destructive break-words">
              {row.error_message}
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-dashed border-border space-y-3">
          {/* Friendly summary table — what an admin actually reads */}
          <SummaryGrid row={row} />

          {/* Everything else is for developers / deep diagnostics */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground select-none flex items-center gap-1">
              <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
              Developer details
              <span className="text-[10px] text-muted-foreground/70">
                (IDs, full payloads, headers)
              </span>
            </summary>
            <div className="mt-2 pl-4 space-y-3">
              <DevIdGrid row={row} />
              {row.metadata && (
                <PayloadBlock title="Metadata" data={row.metadata} />
              )}
              {row.request_payload != null && (
                <PayloadBlock title="Request payload" data={row.request_payload} />
              )}
              {row.response_payload != null && (
                <PayloadBlock title="Response payload" data={row.response_payload} />
              )}
              {row.response_headers && (
                <PayloadBlock
                  title="Response headers"
                  data={row.response_headers}
                />
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

/**
 * Human-readable summary the admin sees first when expanding a row.
 * Maps the raw record into the questions Jonny actually asks:
 *   - what happened?
 *   - which customer?
 *   - which order?
 *   - did the system retry / how slow?
 *   - what's the error?  (already shown above; included here for context)
 */
function SummaryGrid({ row }: { row: LogRow }) {
  const cells: Array<[string, ReactNode | null]> = [
    ["What happened", humanizeAction(row)],
    ["Outcome", outcomeText(row)],
    ["When", new Date(row.created_at).toLocaleString()],
    [
      "Order",
      row.order_number ? (
        <span className="font-mono">{row.order_number}</span>
      ) : null,
    ],
    [
      "Order total",
      row.order_total != null ? formatCurrency(row.order_total) : null,
    ],
    ["Customer", row.customer_name],
    [
      "Customer email",
      row.customer_email ? (
        <a
          href={`mailto:${row.customer_email}`}
          className="text-primary underline decoration-dotted"
        >
          {row.customer_email}
        </a>
      ) : null,
    ],
    [
      "Duration",
      row.duration_ms != null ? `${row.duration_ms} ms` : null,
    ],
    [
      "API endpoint",
      row.method !== "EVENT" ? (
        <span className="font-mono text-xs">
          {row.method} {row.endpoint}
        </span>
      ) : null,
    ],
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
      {cells.map(([k, v]) =>
        v ? (
          <div key={k} className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">{k}</span>
            <span className="break-all">{v}</span>
          </div>
        ) : null,
      )}
    </div>
  )
}

function outcomeText(row: LogRow): string {
  if (row.status === "success") return "Succeeded"
  if (row.status === "warning") return "Soft failure (provider returned a notice)"
  if (row.http_status === 0 && row.method !== "EVENT")
    return "No response from provider — network error"
  if (row.error_code) return `Failed — ${row.error_code}`
  return "Failed"
}

function formatCurrency(n: number): string {
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

/**
 * The IDs developers need (UUIDs, Xero/MacShip object IDs) — kept under
 * the "Developer details" disclosure so admins aren't staring at a wall
 * of hex strings.
 */
function DevIdGrid({ row }: { row: LogRow }) {
  const cells: Array<[string, string | null]> = [
    ["Order id", row.order_id],
    ["User id", row.user_id],
    ["Correlation id", row.correlation_id],
    [
      "Entity",
      row.entity_type
        ? `${row.entity_type}${row.entity_id ? ` / ${row.entity_id}` : ""}`
        : null,
    ],
    ["Xero id", row.xero_id],
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
      {cells.map(([k, v]) =>
        v ? (
          <div key={k} className="flex gap-2">
            <span className="text-muted-foreground w-32 shrink-0">{k}</span>
            <span className="font-mono break-all">{v}</span>
          </div>
        ) : null,
      )}
    </div>
  )
}

function PayloadBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {title}
      </div>
      <pre className="text-xs bg-muted text-foreground border border-border rounded p-3 overflow-x-auto max-h-96 font-mono">
        {safeStringify(data)}
      </pre>
    </div>
  )
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
