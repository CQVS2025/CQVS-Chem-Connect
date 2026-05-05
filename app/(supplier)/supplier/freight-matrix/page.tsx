import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import FreightMatrixClient from "./FreightMatrixClient"

interface WarehouseRow {
  id: string
  name: string
  is_supplier_managed: boolean | null
}

export default async function SupplierFreightMatrixPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/supplier/freight-matrix")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const role = (profile as { role?: string } | null)?.role
  const isAdmin = role === "admin"

  let warehouses: WarehouseRow[] = []
  let canUpdateWarehouseIds: string[] = []

  if (isAdmin) {
    const { data: all } = await supabase
      .from("warehouses")
      .select("id, name, is_supplier_managed")
      .eq("is_supplier_managed", true)
      .order("name")
    warehouses = (all ?? []) as WarehouseRow[]
    canUpdateWarehouseIds = warehouses.map((w) => w.id)
  } else {
    const { data: memberships } = await supabase
      .from("warehouse_users")
      .select("warehouse_id, can_update_orders")
      .eq("user_id", user.id)
    const ids = (memberships ?? []).map(
      (m: { warehouse_id: string }) => m.warehouse_id,
    )
    canUpdateWarehouseIds = (memberships ?? [])
      .filter((m: { can_update_orders: boolean }) => m.can_update_orders)
      .map((m: { warehouse_id: string }) => m.warehouse_id)

    if (ids.length === 0) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Freight Matrix</h1>
          <p className="text-sm text-muted-foreground">
            You are not assigned to any warehouses yet. Contact Chem Connect
            admin to be added.
          </p>
        </div>
      )
    }

    const { data: rows } = await supabase
      .from("warehouses")
      .select("id, name, is_supplier_managed")
      .in("id", ids)
      .eq("is_supplier_managed", true)
      .order("name")
    warehouses = (rows ?? []) as WarehouseRow[]
  }

  if (warehouses.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Freight Matrix</h1>
        <p className="text-sm text-muted-foreground">
          No supplier-managed warehouses available.
        </p>
      </div>
    )
  }

  return (
    <FreightMatrixClient
      warehouses={warehouses}
      canUpdateWarehouseIds={canUpdateWarehouseIds}
    />
  )
}
