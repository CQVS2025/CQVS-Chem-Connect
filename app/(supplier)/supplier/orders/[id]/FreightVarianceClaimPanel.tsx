"use client"

// Supplier raises a pre-dispatch freight variance claim. Once dispatch
// has begun (status leaves received/processing), the claim window has
// closed per contract - supplier absorbs the variance.

import { useEffect, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"

interface Claim {
  id: string
  claimed_amount: number
  notification_evidence: string | null
  notified_at: string | null
  status: "pending" | "approved" | "rejected"
  decision_note: string | null
  reviewed_at: string | null
  created_at: string
}

export function FreightVarianceClaimPanel({
  orderId,
  quotedFreight,
  orderStatus,
  canEdit,
}: {
  orderId: string
  quotedFreight: number
  orderStatus: string
  canEdit: boolean
}) {
  const [claims, setClaims] = useState<Claim[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({
    claimed_amount: quotedFreight.toFixed(2),
    notification_evidence: "",
    notified_at: "",
  })
  const [error, setError] = useState<string | null>(null)

  const claimWindowOpen = ["received", "processing"].includes(orderStatus)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/supplier/freight-variance-claims?order_id=${orderId}`,
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
  }, [orderId])

  async function submit() {
    setError(null)
    const amount = Number(draft.claimed_amount)
    if (!amount || amount <= 0) {
      setError("Claimed amount must be a positive number.")
      return
    }
    const res = await fetch("/api/supplier/freight-variance-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        claimed_amount: amount,
        notification_evidence: draft.notification_evidence || null,
        notified_at: draft.notified_at || null,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? `Submit failed (${res.status})`)
      return
    }
    setAdding(false)
    setDraft({
      claimed_amount: quotedFreight.toFixed(2),
      notification_evidence: "",
      notified_at: "",
    })
    load()
  }

  async function withdraw(id: string) {
    if (!confirm("Withdraw this pending claim?")) return
    const res = await fetch(`/api/supplier/freight-variance-claims/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      alert(`Withdraw failed: ${(await res.json()).error ?? res.status}`)
      return
    }
    load()
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Per contract, you are paid the freight amount that was quoted at the
        moment the buyer paid (
        <strong>${quotedFreight.toFixed(2)}</strong>). If your actual freight
        cost will exceed that amount, raise a claim before dispatching the
        order. Admin will review and decide.
      </p>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && !claims && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      )}

      {claims && claims.length > 0 && (
        <ul className="space-y-2">
          {claims.map((c) => (
            <li
              key={c.id}
              className="rounded border border-border bg-muted/30 p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">
                    ${Number(c.claimed_amount).toFixed(2)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    vs quoted ${quotedFreight.toFixed(2)}
                  </span>
                </div>
                <StatusPill status={c.status} />
              </div>
              {c.notification_evidence && (
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium">Evidence:</span>{" "}
                  {c.notification_evidence}
                </p>
              )}
              {c.notified_at && (
                <p className="text-muted-foreground">
                  Notified at: {new Date(c.notified_at).toLocaleString("en-AU")}
                </p>
              )}
              {c.decision_note && (
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium">Admin note:</span>{" "}
                  {c.decision_note}
                </p>
              )}
              {c.status === "pending" && canEdit && (
                <button
                  type="button"
                  onClick={() => withdraw(c.id)}
                  className="mt-2 inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                >
                  <X className="h-3 w-3" /> Withdraw
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {claims && claims.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No claims raised.</p>
      )}

      {canEdit && claimWindowOpen && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Raise variance claim
        </button>
      )}

      {!claimWindowOpen && (
        <p className="rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          The claim window has closed (order is no longer pre-dispatch). You
          will be paid the originally quoted freight amount.
        </p>
      )}

      {adding && (
        <div className="rounded border border-primary/40 bg-card p-3 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-muted-foreground">
                Claimed amount (AUD)
              </label>
              <input
                type="number"
                step="0.01"
                value={draft.claimed_amount}
                onChange={(e) =>
                  setDraft({ ...draft, claimed_amount: e.target.value })
                }
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block font-medium text-muted-foreground">
                Notified at (when you informed admin)
              </label>
              <input
                type="datetime-local"
                value={draft.notified_at}
                onChange={(e) =>
                  setDraft({ ...draft, notified_at: e.target.value })
                }
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="block font-medium text-muted-foreground">
              Notification evidence
            </label>
            <textarea
              value={draft.notification_evidence}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  notification_evidence: e.target.value,
                })
              }
              rows={3}
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
              placeholder="e.g. emailed admin@chemconnect.com on 2026-05-04 at 09:30 with the quote from carrier X"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded border border-border px-3 py-1 hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded bg-primary px-3 py-1 font-medium text-primary-foreground hover:opacity-90"
            >
              Submit claim
            </button>
          </div>
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
