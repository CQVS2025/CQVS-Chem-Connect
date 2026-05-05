import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import VarianceClaimsClient from "./VarianceClaimsClient"

export default async function AdminVarianceClaimsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/admin/supplier-fulfillment/variance-claims")
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if ((profile as { role?: string } | null)?.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Freight Variance Claims</h1>
        <p className="text-sm text-muted-foreground">
          Pre-dispatch claims from suppliers requesting reimbursement above
          the matrix-quoted freight. Approving sets the supplier&apos;s payout
          to the claimed amount on the next dispatch transition.
        </p>
      </header>
      <VarianceClaimsClient />
    </div>
  )
}
