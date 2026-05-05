import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { SupplierDispatchForm } from "./SupplierDispatchForm"
import { SupplierAuditTrail } from "./SupplierAuditTrail"
import { FreightVarianceClaimPanel } from "./FreightVarianceClaimPanel"

interface OrderDetail {
  id: string
  order_number: string
  status: string
  created_at: string
  total: number
  shipping: number
  warehouse_id: string
  delivery_address_street: string | null
  delivery_address_city: string | null
  delivery_address_state: string | null
  delivery_address_postcode: string | null
  delivery_notes: string | null
  site_access_answers: Record<string, unknown> | null
  supplier_dispatch_date: string | null
  estimated_delivery: string | null
  supplier_dispatch_notes: string | null
  supplier_tracking_url: string | null
  supplier_origin_postcode: string | null
  supplier_variance_flagged: boolean
  supplier_variance_amount: number | null
  supplier_sla_breached: boolean
  order_items: Array<{
    id: string
    product_name: string
    quantity: number
    packaging_size: string
    unit_price: number
    total_price: number
  }>
  profiles: {
    contact_name: string | null
    email: string
    phone: string | null
    company_name: string | null
  } | null
}

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/supplier/orders/${id}`)

  // Two-step fetch: orders.user_id references auth.users (not profiles),
  // so PostgREST can't traverse the transitive relationship via an
  // embedded select. Pull the order + items first, then look up the
  // buyer's profile separately. The profiles RLS lets the supplier read
  // their own row only, so we use the service-role client for the buyer
  // profile lookup (admin needs to see buyer contact details to call
  // ahead before pumping - Q8 in the locked spec).
  const { data: order } = await supabase
    .from("orders")
    .select(
      `*, order_items (id, product_name, quantity, packaging_size, unit_price, total_price)`,
    )
    .eq("id", id)
    .single()

  if (!order) notFound()

  // Scope check - run before any other DB reads so suppliers can't probe
  // for orders outside their warehouse via direct URL.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const isAdmin = (profile as { role?: string } | null)?.role === "admin"

  // PO orders sit in `pending_approval` until an admin approves them and
  // move to `rejected` if the admin declines. Suppliers have no business
  // viewing either - approval hasn't happened yet, or the order is dead.
  // Admins keep access (they need to act on these from the supplier view
  // when triaging). Show a clear notice instead of leaking buyer fields.
  const blockedStatus = (order as { status: string }).status
  if (
    !isAdmin &&
    (blockedStatus === "pending_approval" || blockedStatus === "rejected")
  ) {
    return <BlockedNotice status={blockedStatus} />
  }

  const { createServiceRoleClient } = await import(
    "@/lib/supabase/service-role"
  )
  const service = createServiceRoleClient()
  const { data: buyerProfile } = await service
    .from("profiles")
    .select("contact_name, email, phone, company_name")
    .eq("id", (order as { user_id: string }).user_id)
    .maybeSingle()
  ;(order as { profiles?: typeof buyerProfile }).profiles = buyerProfile

  let canUpdate = isAdmin
  if (!isAdmin) {
    const { data: membership } = await supabase
      .from("warehouse_users")
      .select("can_update_orders")
      .eq("user_id", user.id)
      .eq("warehouse_id", order.warehouse_id)
      .maybeSingle()
    if (!membership) {
      redirect("/supplier")
    }
    canUpdate = !!(membership as { can_update_orders: boolean }).can_update_orders
  }

  const o = order as OrderDetail
  const address = [
    o.delivery_address_street,
    o.delivery_address_city,
    o.delivery_address_state,
    o.delivery_address_postcode,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/supplier"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All orders
          </Link>
          <h1 className="text-2xl font-semibold">{o.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {new Date(o.created_at).toLocaleString("en-AU")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {o.supplier_sla_breached && (
            <span className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              SLA breached - confirm an ETA
            </span>
          )}
          {o.supplier_variance_flagged && (
            <span className="rounded bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              Variance flagged: ${o.supplier_variance_amount?.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Buyer">
          <Row label="Name" value={o.profiles?.contact_name ?? "-"} />
          <Row label="Company" value={o.profiles?.company_name ?? "-"} />
          <Row label="Email" value={o.profiles?.email ?? "-"} />
          <Row label="Phone" value={o.profiles?.phone ?? "-"} />
        </Card>

        <Card title="Delivery">
          <Row label="Address" value={address || "-"} />
          {o.delivery_notes && <Row label="Notes" value={o.delivery_notes} />}
        </Card>

        <Card title="Items" className="md:col-span-2">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Product</th>
                <th className="py-2 text-left">Packaging</th>
                <th className="py-2 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {o.order_items.map((it) => {
                const display = describeQuantity(it.packaging_size, it.quantity)
                return (
                  <tr key={it.id}>
                    <td className="py-2">{it.product_name}</td>
                    <td className="py-2">{it.packaging_size}</td>
                    <td className="py-2 text-right">
                      <div className="font-medium">{display.primary}</div>
                      {display.secondary && (
                        <div className="text-xs text-muted-foreground">
                          {display.secondary}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Site Access" className="md:col-span-2">
          {o.site_access_answers && Object.keys(o.site_access_answers).length > 0 ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(o.site_access_answers).map(([k, v]) => (
                <div key={k} className="text-sm">
                  <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                  <dd className="font-medium">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No site-access answers recorded.</p>
          )}
        </Card>

        <Card title="Activity" className="md:col-span-2">
          <SupplierAuditTrail orderId={o.id} />
        </Card>

        <Card title="Freight Variance Claim" className="md:col-span-2">
          <FreightVarianceClaimPanel
            orderId={o.id}
            quotedFreight={Number(o.shipping ?? 0)}
            orderStatus={o.status}
            canEdit={canUpdate}
          />
        </Card>

        <Card title="Dispatch" className="md:col-span-2">
          {canUpdate ? (
            <SupplierDispatchForm
              orderId={o.id}
              initial={{
                supplier_dispatch_date: o.supplier_dispatch_date,
                estimated_delivery: o.estimated_delivery,
                supplier_dispatch_notes: o.supplier_dispatch_notes,
                supplier_tracking_url: o.supplier_tracking_url,
                supplier_origin_postcode: o.supplier_origin_postcode,
                status: o.status,
              }}
            />
          ) : (
            <div className="space-y-2 text-sm">
              <Row label="Status" value={o.status} />
              <Row
                label="Dispatch Date"
                value={o.supplier_dispatch_date ?? "Not set"}
              />
              <Row label="ETA" value={o.estimated_delivery ?? "Not set"} />
              <Row
                label="Notes"
                value={o.supplier_dispatch_notes ?? "-"}
              />
              <Row
                label="Tracking URL"
                value={o.supplier_tracking_url ?? "-"}
              />
              <p className="rounded border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                You have read-only access to this warehouse.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function BlockedNotice({ status }: { status: string }) {
  const isPending = status === "pending_approval"
  return (
    <div className="space-y-4">
      <Link
        href="/supplier"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← All orders
      </Link>
      <div
        className={`rounded-lg border p-6 ${
          isPending
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <h1
          className={`text-lg font-semibold ${
            isPending ? "text-amber-700 dark:text-amber-400" : "text-destructive"
          }`}
        >
          {isPending
            ? "Awaiting admin approval"
            : "Order rejected by admin"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPending
            ? "This PO order has not been approved yet. You will be able to view and dispatch it once Chem Connect admin approves the purchase order."
            : "This PO order was rejected by Chem Connect admin and will not move forward. No supplier action is required."}
        </p>
      </div>
    </div>
  )
}

function Card({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-card p-4 ${className ?? ""}`}
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

// Bulk-tanker style packaging stores the litres ordered as the
// quantity field (volume_litres = 1 by convention). For any other
// packaging the quantity is the number of containers. Render the
// quantity contextually so the supplier instantly understands what
// they need to dispatch (e.g. "300 L" vs "300 × IBC").
function describeQuantity(
  packagingSize: string,
  quantity: number,
): { primary: string; secondary: string | null } {
  const ps = packagingSize.toLowerCase()
  const isBulk = ps.includes("bulk") || ps.includes("tanker")
  if (isBulk) {
    return {
      primary: `${quantity.toLocaleString()} L`,
      secondary: "to dispatch in bulk",
    }
  }
  return {
    primary: `${quantity.toLocaleString()} × ${packagingSize}`,
    secondary: null,
  }
}
