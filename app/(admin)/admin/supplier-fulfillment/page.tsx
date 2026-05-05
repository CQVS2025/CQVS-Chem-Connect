// Admin supplier-fulfillment console.
//
// Brings together the new admin surfaces:
//   - Supplier-managed warehouses and their users (component 1, 2)
//   - Rate sheets + brackets (components 3-5)
//   - Site-access questions (component 6)
//   - SLA flag refresh button (component 14)
//   - Reconciliation view (component 15)
//   - Mixed-cart block events counter (component 17)

import Link from "next/link"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function AdminSupplierFulfillmentPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/admin/supplier-fulfillment")
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if ((profile as { role?: string } | null)?.role !== "admin") redirect("/dashboard")

  const [{ data: warehouses }, { data: rateSheets }, { data: blocks }, { data: stuck }] =
    await Promise.all([
      supabase
        .from("warehouses")
        .select("id, name, address_state, address_postcode, is_supplier_managed, is_active")
        .eq("is_supplier_managed", true)
        .order("name"),
      supabase
        .from("supplier_rate_sheets")
        .select("id, warehouse_id, name, unit_type, is_active")
        .order("created_at", { ascending: false }),
      supabase
        .from("mixed_cart_block_events")
        .select("id, created_at, macship_product_name, supplier_product_name")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("orders")
        .select("id, order_number, created_at")
        .eq("supplier_sla_breached", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Supplier-Managed Fulfillment</h1>
        <p className="text-sm text-muted-foreground">
          Configure supplier warehouses, rate sheets, site-access questions and
          monitor SLA / variance / mixed-cart signals.
        </p>
      </header>

      <Section
        title={`Supplier warehouses (${warehouses?.length ?? 0})`}
        action={
          <Link
            className="text-sm text-primary hover:underline"
            href="/admin/warehouses"
          >
            Manage in Warehouses →
          </Link>
        }
      >
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-1">Name</th>
              <th>State</th>
              <th>Postcode</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(warehouses ?? []).map((w) => (
              <tr key={w.id}>
                <td className="py-2">{w.name}</td>
                <td>{w.address_state}</td>
                <td>{w.address_postcode}</td>
                <td>{w.is_active ? "Yes" : "No"}</td>
                <td className="text-right">
                  <Link
                    href={`/admin/supplier-fulfillment/warehouses/${w.id}`}
                    className="text-primary hover:underline"
                  >
                    Configure →
                  </Link>
                </td>
              </tr>
            ))}
            {(warehouses ?? []).length === 0 && (
              <tr>
                <td className="py-3 text-muted-foreground" colSpan={5}>
                  No supplier-managed warehouses yet. Create one in
                  Warehouses, then flag it as supplier-managed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title={`Rate sheets (${rateSheets?.length ?? 0})`}>
        <ul className="text-sm">
          {(rateSheets ?? []).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
            >
              <span>
                <strong>{r.name}</strong>{" "}
                <span className="text-xs text-muted-foreground">{r.unit_type}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {r.is_active ? "Active" : "Inactive"}
              </span>
            </li>
          ))}
          {(rateSheets ?? []).length === 0 && (
            <li className="py-3 text-muted-foreground">No rate sheets yet.</li>
          )}
        </ul>
      </Section>

      <Section
        title="Freight variance claims"
        action={
          <Link
            className="text-sm text-primary hover:underline"
            href="/admin/supplier-fulfillment/variance-claims"
          >
            Open queue →
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Pre-dispatch claims raised by suppliers when their actual freight
          cost exceeds the matrix-quoted amount. Approving overrides the
          locked freight on the order; rejecting holds the supplier to the
          original quote.
        </p>
      </Section>

      <Section
        title="SLA - supplier-managed orders awaiting an ETA"
        action={
          <form action="/api/admin/supplier-fulfillment/sla-refresh" method="post">
            <button
              type="submit"
              className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
            >
              Refresh
            </button>
          </form>
        }
      >
        {stuck && stuck.length > 0 ? (
          <ul className="text-sm">
            {stuck.map((o) => (
              <li key={o.id} className="border-b border-border py-1.5 last:border-b-0">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="text-primary hover:underline"
                >
                  {o.order_number}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">
                  placed {new Date(o.created_at).toLocaleString("en-AU")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No stuck orders.</p>
        )}
      </Section>

      <Section
        title={`Mixed-cart blocks - ${blocks?.length ?? 0} recent`}
        action={
          <span className="text-xs text-muted-foreground">
            Phase 2 sizing signal
          </span>
        }
      >
        {blocks && blocks.length > 0 ? (
          <ul className="text-sm">
            {blocks.map((b) => (
              <li key={b.id} className="border-b border-border py-1.5 last:border-b-0">
                <span className="text-muted-foreground">
                  {new Date(b.created_at).toLocaleString("en-AU")} -{" "}
                </span>
                <span>
                  {b.macship_product_name ?? "?"} × {b.supplier_product_name ?? "?"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No mixed-cart blocks yet.</p>
        )}
      </Section>

      <Section title="Quick links">
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/admin/supplier-fulfillment/products"
              className="text-primary hover:underline"
            >
              Per-product configuration (rate sheets + checkout questions) →
            </Link>
          </li>
          <li>
            <Link
              href="/admin/supplier-fulfillment/reconciliation"
              className="text-primary hover:underline"
            >
              Reconciliation report (full margin per order) →
            </Link>
          </li>
        </ul>
      </Section>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}
