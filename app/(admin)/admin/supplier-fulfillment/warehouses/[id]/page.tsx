// Per-warehouse configuration: rate sheets, supplier users, site-access
// questions per product+packaging mapped to this warehouse.

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { WarehouseConfigClient } from "./WarehouseConfigClient"

export default async function WarehouseConfigPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/admin/supplier-fulfillment/warehouses/${id}`)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if ((profile as { role?: string } | null)?.role !== "admin") redirect("/dashboard")

  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, name, address_postcode, address_state, is_supplier_managed, is_active")
    .eq("id", id)
    .single()
  if (!warehouse) notFound()

  return (
    <div className="space-y-4">
      <Link
        href="/admin/supplier-fulfillment"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Supplier fulfillment
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{warehouse.name}</h1>
        <p className="text-sm text-muted-foreground">
          {warehouse.address_state} {warehouse.address_postcode} ·{" "}
          {warehouse.is_supplier_managed
            ? "Supplier-managed"
            : "Standard MacShip"}
        </p>
      </header>
      <WarehouseConfigClient warehouseId={id} />
    </div>
  )
}
