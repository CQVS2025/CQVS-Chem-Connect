// Supplier dashboard order list (component 9). Scoped to the supplier's
// warehouses; admins see everything supplier-managed.

import Link from "next/link"
import { createServerSupabaseClient } from "@/lib/supabase/server"

interface OrderRow {
  id: string
  order_number: string
  status: string
  created_at: string
  total: number
  supplier_dispatch_date: string | null
  estimated_delivery: string | null
  supplier_variance_flagged: boolean
  supplier_sla_breached: boolean
  delivery_address_state: string | null
  delivery_address_city: string | null
  warehouse_id: string
}

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const isAdmin = (profile as { role?: string } | null)?.role === "admin"

  let warehouseIds: string[] = []
  if (!isAdmin) {
    const { data: memberships } = await supabase
      .from("warehouse_users")
      .select("warehouse_id")
      .eq("user_id", user.id)
    warehouseIds = (memberships ?? []).map(
      (m: { warehouse_id: string }) => m.warehouse_id,
    )
  }

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, created_at, total, supplier_dispatch_date, estimated_delivery, supplier_variance_flagged, supplier_sla_breached, delivery_address_state, delivery_address_city, warehouse_id",
    )
    .order("created_at", { ascending: false })

  if (!isAdmin) {
    if (warehouseIds.length === 0) return <NoWarehouses />
    query = query.in("warehouse_id", warehouseIds)
  } else {
    // Admin view: only supplier-managed warehouse orders here. Master
    // admin orders page covers everything.
    const { data: supplierWarehouses } = await supabase
      .from("warehouses")
      .select("id")
      .eq("is_supplier_managed", true)
    query = query.in(
      "warehouse_id",
      (supplierWarehouses ?? []).map((w: { id: string }) => w.id),
    )
  }

  if (params.status) query = query.eq("status", params.status)

  const { data: orders } = await query
  const rows = (orders ?? []) as OrderRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Supplier Orders</h1>
        <p className="text-sm text-muted-foreground">
          Confirm dispatch and delivery dates for orders fulfilled from your
          warehouse(s). Buyers are notified automatically when a date is set
          or changes.
        </p>
      </div>

      <FilterBar current={params.status} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Dispatch</th>
              <th className="px-4 py-3">ETA</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => {
              // PO orders pending admin approval (or already rejected)
              // are not actionable by the supplier - the detail page
              // blocks the same statuses server-side. Render the order
              // number as plain text + a small explainer so the
              // supplier knows the order exists but can't drill in.
              const isBlocked =
                o.status === "pending_approval" || o.status === "rejected"
              return (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  {isBlocked ? (
                    <span className="font-medium text-muted-foreground">
                      {o.order_number}
                    </span>
                  ) : (
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/supplier/orders/${o.id}`}
                    >
                      {o.order_number}
                    </Link>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("en-AU")}
                  </div>
                  {isBlocked && (
                    <div
                      className={`mt-1 text-[11px] ${
                        o.status === "rejected"
                          ? "text-destructive"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {o.status === "rejected"
                        ? "Rejected by admin - no action required"
                        : "Awaiting admin approval"}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={o.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {o.delivery_address_city || "-"}
                  {o.delivery_address_state ? `, ${o.delivery_address_state}` : ""}
                </td>
                <td className="px-4 py-3">
                  {o.supplier_dispatch_date ?? <em className="text-muted-foreground">Not set</em>}
                </td>
                <td className="px-4 py-3">
                  {o.estimated_delivery ?? <em className="text-muted-foreground">Not set</em>}
                </td>
                <td className="px-4 py-3 space-x-1">
                  {o.supplier_sla_breached && (
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      SLA
                    </span>
                  )}
                  {o.supplier_variance_flagged && (
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Variance
                    </span>
                  )}
                </td>
              </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterBar({ current }: { current: string | undefined }) {
  const filters = [
    { label: "All", value: "" },
    { label: "Pending Approval", value: "pending_approval" },
    { label: "Received", value: "received" },
    { label: "Processing", value: "processing" },
    { label: "In Transit", value: "in_transit" },
    { label: "Delivered", value: "delivered" },
    { label: "Rejected", value: "rejected" },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <Link
          key={f.value || "all"}
          href={f.value ? `/supplier?status=${f.value}` : "/supplier"}
          className={
            (current ?? "") === f.value
              ? "rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              : "rounded border border-border px-3 py-1 text-xs hover:bg-muted"
          }
        >
          {f.label}
        </Link>
      ))}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_approval: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    received: "bg-primary/10 text-primary",
    processing: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    in_transit: "bg-primary/10 text-primary",
    delivered: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    cancelled: "bg-destructive/10 text-destructive",
    rejected: "bg-destructive/10 text-destructive",
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        map[status] ?? "bg-muted text-foreground"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  )
}

function NoWarehouses() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm">
      You are not assigned to any supplier warehouses yet. Please contact
      Chem Connect admin.
    </div>
  )
}
