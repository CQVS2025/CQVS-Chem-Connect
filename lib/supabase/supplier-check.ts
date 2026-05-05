// Auth helper: returns the signed-in user's warehouse memberships.
//
// Supplier dashboard routes call this to scope queries to "only orders
// for warehouses I'm a member of". An admin user implicitly has access
// to every warehouse.

import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "./server"

export interface SupplierContext {
  user: { id: string; email: string }
  isAdmin: boolean
  warehouseIds: string[]
  canUpdateWarehouseIds: string[]
}

export async function requireSupplier() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      supabase,
      ctx: null as SupplierContext | null,
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single()

  const role = (profile as { role: string } | null)?.role ?? "customer"
  const isAdmin = role === "admin"

  const { data: memberships } = await supabase
    .from("warehouse_users")
    .select("warehouse_id, can_update_orders")
    .eq("user_id", user.id)

  const warehouseIds =
    (memberships ?? []).map(
      (m: { warehouse_id: string }) => m.warehouse_id,
    )
  const canUpdateWarehouseIds = (memberships ?? [])
    .filter((m: { can_update_orders: boolean }) => m.can_update_orders)
    .map((m: { warehouse_id: string }) => m.warehouse_id)

  if (!isAdmin && warehouseIds.length === 0) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      supabase,
      ctx: null as SupplierContext | null,
    }
  }

  return {
    error: null,
    supabase,
    ctx: {
      user: { id: user.id, email: user.email ?? "" },
      isAdmin,
      warehouseIds,
      canUpdateWarehouseIds,
    },
  }
}
