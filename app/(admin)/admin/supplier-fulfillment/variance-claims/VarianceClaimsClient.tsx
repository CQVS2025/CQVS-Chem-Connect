"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2, X } from "lucide-react"

interface Claim {
  id: string
  order_id: string
  warehouse_id: string
  claimed_amount: number
  notification_evidence: string | null
  notified_at: string | null
  status: "pending" | "approved" | "rejected"
  decision_note: string | null
  reviewed_at: string | null
  created_at: string
  orders: {
    order_number: string
    shipping: number
    status: string
    supplier_freight_cost: number | null
  }
  warehouses: { name: string }
}

const TABS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
]

export default function VarianceClaimsClient() {
  const [filter, setFilter] = useState<string>("pending")
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewState, setReviewState] = useState<
    Record<string, { amount: string; note: string }>
  >({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/freight-variance-claims${filter ? `?status=${filter}` : ""}`,
      )
      if (!res.ok) throw new Error(`Load failed (${res.status})`)
      setClaims((await res.json()) as Claim[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function decide(
    claim: Claim,
    status: "approved" | "rejected",
  ) {
    setBusyId(claim.id)
    setError(null)
    try {
      const draft = reviewState[claim.id] ?? {
        amount: claim.claimed_amount.toString(),
        note: "",
      }
      const body: Record<string, unknown> = {
        status,
        decision_note: draft.note || null,
      }
      if (status === "approved") body.claimed_amount = Number(draft.amount)
      const res = await fetch(`/api/admin/freight-variance-claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Decision failed (${res.status})`)
      }
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            onClick={() => setFilter(t.value)}
            className={
              filter === t.value
                ? "rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded border border-border px-3 py-1 text-xs hover:bg-muted"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !claims ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}

      {claims && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Quoted</th>
                <th className="px-4 py-3">Claimed</th>
                <th className="px-4 py-3">Notified</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {claims.map((c) => {
                const draft = reviewState[c.id] ?? {
                  amount: c.claimed_amount.toString(),
                  note: "",
                }
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${c.order_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.orders.order_number}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {c.orders.status}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.warehouses.name}</td>
                    <td className="px-4 py-3">
                      ${Number(c.orders.shipping).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === "pending" ? (
                        <input
                          type="number"
                          step="0.01"
                          value={draft.amount}
                          onChange={(e) =>
                            setReviewState({
                              ...reviewState,
                              [c.id]: { ...draft, amount: e.target.value },
                            })
                          }
                          className="w-28 rounded border border-border bg-background px-2 py-1 text-sm"
                        />
                      ) : (
                        `$${Number(c.claimed_amount).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.notified_at ? (
                        <>
                          {new Date(c.notified_at).toLocaleString("en-AU")}
                          <div className="text-muted-foreground">
                            Created{" "}
                            {new Date(c.created_at).toLocaleString("en-AU")}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Not provided
                        </span>
                      )}
                      {c.notification_evidence && (
                        <p className="mt-1 max-w-xs whitespace-pre-wrap text-muted-foreground">
                          {c.notification_evidence}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} />
                      {c.decision_note && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {c.decision_note}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === "pending" ? (
                        <div className="space-y-2">
                          <textarea
                            value={draft.note}
                            onChange={(e) =>
                              setReviewState({
                                ...reviewState,
                                [c.id]: { ...draft, note: e.target.value },
                              })
                            }
                            rows={2}
                            placeholder="Decision note (optional)"
                            className="w-48 rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={busyId === c.id}
                              onClick={() => decide(c, "approved")}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === c.id}
                              onClick={() => decide(c, "rejected")}
                              className="inline-flex items-center gap-1 rounded bg-destructive px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Reviewed{" "}
                          {c.reviewed_at &&
                            new Date(c.reviewed_at).toLocaleString("en-AU")}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {claims.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No claims for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: Claim["status"] }) {
  const map: Record<Claim["status"], string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    rejected: "bg-destructive/10 text-destructive",
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  )
}
