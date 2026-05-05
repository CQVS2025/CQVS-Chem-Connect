// POST /api/admin/supplier-fulfillment/sla-refresh
//
// Sweeps supplier-managed orders and toggles supplier_sla_breached for any
// where:
//   - the cart is supplier-managed (warehouse.is_supplier_managed = true)
//   - estimated_delivery IS NULL
//   - the order was placed > supplier_sla_hours ago
//
// Run from a cron (component 14). Returns the number of newly-flagged orders.

import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function POST() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { data: settings } = await supabase
    .from("admin_settings")
    .select("key, value")
    .eq("key", "supplier_sla_hours")
    .maybeSingle()
  const hours = parseFloat((settings as { value: string } | null)?.value ?? "24")

  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id")
    .eq("is_supplier_managed", true)
  const warehouseIds = (warehouses ?? []).map((w: { id: string }) => w.id)
  if (warehouseIds.length === 0) {
    return NextResponse.json({ flagged: 0 })
  }

  const { data: stuck, error } = await supabase
    .from("orders")
    .update({ supplier_sla_breached: true })
    .is("estimated_delivery", null)
    .eq("supplier_sla_breached", false)
    .in("warehouse_id", warehouseIds)
    .lte("created_at", cutoff)
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flagged: stuck?.length ?? 0 })
}
