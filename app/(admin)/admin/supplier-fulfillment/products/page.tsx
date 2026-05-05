// Per-product configuration: which rate sheet does this product use,
// and which site-access questions show up at checkout.
//
// Reachable from the Supplier Fulfillment overview ("Products" tile) or
// directly via /admin/supplier-fulfillment/products.

import { redirect } from "next/navigation"
import Link from "next/link"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ProductFulfillmentConfigClient } from "./ProductFulfillmentConfigClient"

export default async function ProductsConfigPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/admin/supplier-fulfillment/products")
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if ((profile as { role?: string } | null)?.role !== "admin") redirect("/dashboard")

  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug")
    .order("name", { ascending: true })

  return (
    <div className="space-y-4">
      <Link
        href="/admin/supplier-fulfillment"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Supplier fulfillment
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Per-product configuration</h1>
        <p className="text-sm text-muted-foreground">
          For each supplier-managed product: pick the freight rate sheet and
          the site-access questions buyers must answer at checkout.
        </p>
      </header>
      <ProductFulfillmentConfigClient
        products={(products ?? []) as Array<{ id: string; name: string; slug: string }>}
      />
    </div>
  )
}
