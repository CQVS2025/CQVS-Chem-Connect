"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, RotateCcw } from "lucide-react"

interface Row {
  id: string
  order_number: string
  created_at: string
  warehouse_id: string
  status: string
  xero_po_number: string | null
  subtotal: number
  buyer_shipping: number
  product_cost: number
  supplier_freight: number
  freight_margin: number
  full_margin: number
  approved_claim_amount: number | null
  approved_claim_note: string | null
  bill_freight: number
  bill_adjustment_needed: boolean
  xero_po_billed_at: string | null
}

interface Counts {
  all: number
  pending: number
  done: number
}

interface Totals {
  subtotal: number
  buyer_shipping: number
  product_cost: number
  supplier_freight: number
  freight_margin: number
  full_margin: number
}

export function ReconciliationTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, done: 0 })
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [billing, setBilling] = useState<"all" | "pending" | "done">("all")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (billing !== "all") params.set("billing", billing)
    fetch(`/api/admin/supplier-fulfillment/reconciliation?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.rows ?? [])
        setTotals(j.totals ?? null)
        setCounts(j.counts ?? { all: 0, pending: 0, done: 0 })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing])

  async function toggleBilled(orderId: string, billed: boolean) {
    setBusyId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/xero-billed`, {
        method: billed ? "POST" : "DELETE",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? `Failed (${res.status})`)
        return
      }
      load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={load}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterTab
          label="All"
          count={counts.all}
          active={billing === "all"}
          onClick={() => setBilling("all")}
        />
        <FilterTab
          label="Pending billing"
          count={counts.pending}
          active={billing === "pending"}
          onClick={() => setBilling("pending")}
          accent="amber"
        />
        <FilterTab
          label="Billed in Xero"
          count={counts.done}
          active={billing === "done"}
          onClick={() => setBilling("done")}
          accent="emerald"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {totals && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label="Sales (subtotal)" value={totals.subtotal} />
          <Tile label="Buyer shipping" value={totals.buyer_shipping} />
          <Tile label="Product cost" value={totals.product_cost} />
          <Tile label="Supplier freight" value={totals.supplier_freight} />
          <Tile label="Freight margin" value={totals.freight_margin} />
          <Tile label="Full margin" value={totals.full_margin} highlight />
        </div>
      )}

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <strong className="text-amber-700 dark:text-amber-400">
          Bill freight column
        </strong>
        <span className="text-muted-foreground">
          {" "}
          - when you click <em>Mark as billed</em> on the Xero PO, set the
          freight line on the draft Bill to this amount before approving.
          Rows with an approved variance claim are highlighted.
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Xero PO</th>
              <th className="px-3 py-2 text-right">PO freight</th>
              <th className="px-3 py-2 text-right">Approved claim</th>
              <th className="px-3 py-2 text-right">Bill freight</th>
              <th className="px-3 py-2 text-right">Product cost</th>
              <th className="px-3 py-2 text-right">Supplier freight</th>
              <th className="px-3 py-2 text-right">Full margin</th>
              <th className="px-3 py-2">Billed in Xero</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  r.bill_adjustment_needed
                    ? "bg-amber-500/10"
                    : undefined
                }
              >
                <td className="px-3 py-2">
                  <div>{r.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-AU")} ·{" "}
                    {r.status}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.xero_po_number ?? (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  ${r.buyer_shipping.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.approved_claim_amount !== null ? (
                    <span className="font-medium">
                      ${r.approved_claim_amount.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {r.bill_adjustment_needed ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      ${r.bill_freight.toFixed(2)}
                    </span>
                  ) : (
                    <span>${r.bill_freight.toFixed(2)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">${r.product_cost.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">
                  ${r.supplier_freight.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  ${r.full_margin.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  {r.xero_po_billed_at ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        {new Date(r.xero_po_billed_at).toLocaleDateString(
                          "en-AU",
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => toggleBilled(r.id, false)}
                        className="rounded border border-border p-1 text-muted-foreground hover:bg-muted"
                        title="Undo (clear billed marker)"
                      >
                        {busyId === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === r.id || !r.xero_po_number}
                      onClick={() => toggleBilled(r.id, true)}
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                        r.bill_adjustment_needed
                          ? "bg-amber-500 text-white hover:opacity-90"
                          : "border border-border hover:bg-muted"
                      } disabled:opacity-50`}
                      title={
                        r.xero_po_number
                          ? "Mark as billed in Xero (after creating + adjusting the Bill there)"
                          : "No Xero PO yet - create the PO before marking billed"
                      }
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Mark as billed
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No supplier-managed orders in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterTab({
  label,
  count,
  active,
  onClick,
  accent,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  accent?: "amber" | "emerald"
}) {
  const accentCls =
    accent === "amber"
      ? active
        ? "bg-amber-500 text-white"
        : "border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
      : accent === "emerald"
        ? active
          ? "bg-emerald-600 text-white"
          : "border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
        : active
          ? "bg-primary text-primary-foreground"
          : "border border-border hover:bg-muted"
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium ${accentCls}`}
    >
      {label}
      <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
        {count}
      </span>
    </button>
  )
}

function Tile({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-border bg-card"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold">${value.toFixed(2)}</div>
    </div>
  )
}
