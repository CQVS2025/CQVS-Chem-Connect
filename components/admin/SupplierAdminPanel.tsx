"use client"

// Admin-side surface for supplier-managed orders.
// Renders inside the expanded admin order row when the order's warehouse
// has is_supplier_managed = true. Mirrors the supplier dashboard fields
// (read-only here, since admin doesn't act as the supplier) and surfaces
// the audit log + site-access answers.

import { useEffect, useMemo, useState } from "react"
import {
  ExternalLink,
  ShieldAlert,
  AlarmClockIcon,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
} from "lucide-react"

interface AdminOrderShape {
  id: string
  warehouse_id: string | null
  supplier_dispatch_date?: string | null
  estimated_delivery?: string | null
  supplier_dispatch_notes?: string | null
  supplier_tracking_url?: string | null
  supplier_origin_postcode?: string | null
  supplier_freight_cost?: number | null
  supplier_variance_flagged?: boolean | null
  supplier_variance_amount?: number | null
  supplier_sla_breached?: boolean | null
  site_access_answers?: Record<string, unknown> | null
  warehouse?: { is_supplier_managed?: boolean } | null
}

interface AuditEntry {
  id: string
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
  actor_id: string | null
}

export function SupplierAdminPanel({ order }: { order: AdminOrderShape }) {
  const isSupplierManaged = order.warehouse?.is_supplier_managed === true
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [auditOpen, setAuditOpen] = useState(true)

  // Always pre-fetch the audit log on mount (no longer behind a "Show"
  // toggle) so admin sees the count + latest activity at a glance and
  // can't miss the entries.
  useEffect(() => {
    if (!isSupplierManaged) return
    fetch(`/api/admin/supplier-fulfillment/audit-log?order_id=${order.id}`)
      .then((r) => r.json())
      .then((rows) => setAudit(Array.isArray(rows) ? rows : []))
      .catch(() => setAudit([]))
  }, [isSupplierManaged, order.id])

  const auditCount = audit?.length ?? 0
  const latestAudit = useMemo(
    () => (audit && audit.length > 0 ? audit[0] : null),
    [audit],
  )

  // For non-supplier-managed orders, render nothing - the existing MacShip
  // surface handles them.
  if (!isSupplierManaged) return null

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Supplier-managed fulfillment
        </h4>
        <div className="flex items-center gap-2">
          {order.supplier_sla_breached && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlarmClockIcon className="h-3 w-3" />
              SLA breached
            </span>
          )}
          {order.supplier_variance_flagged && (
            <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              <ShieldAlert className="h-3 w-3" />
              Variance ${(order.supplier_variance_amount ?? 0).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div className="space-y-1">
          <Row label="Dispatch date" value={order.supplier_dispatch_date} />
          <Row label="Estimated delivery" value={order.estimated_delivery} />
          <Row label="Dispatch notes" value={order.supplier_dispatch_notes} />
          <Row
            label="Dispatch depot postcode"
            value={order.supplier_origin_postcode}
          />
          {order.supplier_tracking_url && (
            <a
              href={order.supplier_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Open tracking URL
            </a>
          )}
          <Row
            label="Supplier freight cost"
            value={
              typeof order.supplier_freight_cost === "number"
                ? `$${order.supplier_freight_cost.toFixed(2)}`
                : null
            }
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Site access answers
          </p>
          {order.site_access_answers &&
          Object.keys(order.site_access_answers).length > 0 ? (
            <dl className="space-y-1">
              {Object.entries(order.site_access_answers).map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <dt className="min-w-[140px] text-xs text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="text-xs">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">None recorded.</p>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
        <button
          type="button"
          onClick={() => setAuditOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Dispatch Activity</span>
            {audit === null ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  auditCount > 0
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {auditCount} {auditCount === 1 ? "entry" : "entries"}
              </span>
            )}
            {latestAudit && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                · last update{" "}
                {new Date(latestAudit.created_at).toLocaleString("en-AU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
          {auditOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {auditOpen && (
          <div className="border-t border-primary/20 bg-background p-3 text-xs">
            {audit === null ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                activity…
              </div>
            ) : audit.length === 0 ? (
              <p className="py-2 text-center text-muted-foreground">
                No dispatch changes recorded yet. Updates from the supplier
                will appear here automatically.
              </p>
            ) : (
              <ul className="space-y-2">
                {audit.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {prettyField(a.field)}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("en-AU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">
                        {a.old_value ?? "(empty)"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                        {a.new_value ?? "(empty)"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  supplier_dispatch_date: "Dispatch date",
  estimated_delivery: "Estimated delivery",
  supplier_dispatch_notes: "Dispatch notes",
  supplier_tracking_url: "Tracking URL",
  supplier_origin_postcode: "Dispatch depot postcode",
  supplier_freight_cost: "Supplier freight cost",
  supplier_variance: "Variance flagged",
  status: "Order status",
}

function prettyField(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ")
}

function Row({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-[140px] text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs">{value || "-"}</span>
    </div>
  )
}
