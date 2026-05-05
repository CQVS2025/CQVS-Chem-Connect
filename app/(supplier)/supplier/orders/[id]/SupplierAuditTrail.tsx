"use client"

import { useEffect, useState } from "react"

interface AuditEntry {
  id: string
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export function SupplierAuditTrail({ orderId }: { orderId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)

  useEffect(() => {
    fetch(`/api/supplier/orders/${orderId}/audit-log`)
      .then((r) => r.json())
      .then((d) => setEntries(d ?? []))
      .catch(() => setEntries([]))
  }, [orderId])

  if (entries === null) {
    return <p className="text-xs text-muted-foreground">Loading…</p>
  }
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No dispatch changes recorded yet.
      </p>
    )
  }
  return (
    <ul className="space-y-1 text-xs">
      {entries.map((a) => (
        <li key={a.id} className="font-mono">
          <span className="text-muted-foreground">
            {new Date(a.created_at).toLocaleString("en-AU")}
          </span>{" "}
          <span className="font-semibold">{a.field}</span>:{" "}
          <span className="text-muted-foreground">{a.old_value ?? "∅"}</span>{" "}
          → <span>{a.new_value ?? "∅"}</span>
        </li>
      ))}
    </ul>
  )
}
