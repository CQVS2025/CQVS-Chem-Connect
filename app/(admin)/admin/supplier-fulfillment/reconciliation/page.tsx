import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ReconciliationTable } from "./ReconciliationTable"

export default async function ReconciliationPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/admin/supplier-fulfillment/reconciliation")
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if ((profile as { role?: string } | null)?.role !== "admin") redirect("/dashboard")

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Per-order full margin for supplier-managed orders. Sale price minus
          product cost minus supplier freight cost.
        </p>
      </header>
      <ReconciliationTable />
    </div>
  )
}
