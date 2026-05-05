"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface Props {
  orderId: string
  initial: {
    supplier_dispatch_date: string | null
    estimated_delivery: string | null
    supplier_dispatch_notes: string | null
    supplier_tracking_url: string | null
    supplier_origin_postcode: string | null
    status: string
  }
}

const STATUS_OPTIONS = [
  { value: "received", label: "Received" },
  { value: "processing", label: "Processing" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
]

export function SupplierDispatchForm({ orderId, initial }: Props) {
  const [dispatchDate, setDispatchDate] = useState(
    initial.supplier_dispatch_date ?? "",
  )
  const [eta, setEta] = useState(initial.estimated_delivery ?? "")
  const [notes, setNotes] = useState(initial.supplier_dispatch_notes ?? "")
  const [trackingUrl, setTrackingUrl] = useState(
    initial.supplier_tracking_url ?? "",
  )
  const [originPostcode, setOriginPostcode] = useState(
    initial.supplier_origin_postcode ?? "",
  )
  const [status, setStatus] = useState(initial.status)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setError(null)

    startTransition(async () => {
      const res = await fetch(`/api/supplier/orders/${orderId}/dispatch`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_dispatch_date: dispatchDate || null,
          estimated_delivery: eta || null,
          supplier_dispatch_notes: notes || null,
          supplier_tracking_url: trackingUrl || null,
          supplier_origin_postcode: originPostcode || null,
          status,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? "Update failed")
        return
      }
      setMessage("Saved. The buyer has been notified of any date changes.")
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dispatch Date">
          <input
            type="date"
            value={dispatchDate}
            onChange={(e) => setDispatchDate(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Estimated Delivery">
          <input
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dispatch Depot Postcode" className="sm:col-span-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={originPostcode}
            placeholder="Defaults to warehouse postcode if blank"
            onChange={(e) => setOriginPostcode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Confirms the depot the truck dispatches from. Used for the freight
            recalculation when you mark this order In Transit.
          </p>
        </Field>
        <Field label="Tracking URL (optional)" className="sm:col-span-2">
          <input
            type="url"
            value={trackingUrl}
            placeholder="https://..."
            onChange={(e) => setTrackingUrl(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Dispatch Notes" className="sm:col-span-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Leaving Brisbane depot Tuesday AM"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {message && (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">{message}</span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </form>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
