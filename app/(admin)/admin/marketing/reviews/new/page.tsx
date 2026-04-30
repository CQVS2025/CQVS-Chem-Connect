import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { ManualReviewEntryForm } from "@/components/admin/manual-review-entry-form"

interface ProductOption {
  id: string
  name: string
  slug: string
}

interface OrderOption {
  id: string
  order_number: string
  user_id: string
}

export const dynamic = "force-dynamic"
export const metadata = { title: "Manual review entry · Chem Connect" }

async function loadProducts(): Promise<ProductOption[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("products")
    .select("id, name, slug")
    .order("name")
    .limit(500)
  return (data ?? []) as ProductOption[]
}

async function loadDeliveredOrders(): Promise<OrderOption[]> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, user_id")
    .eq("status", "delivered")
    .order("created_at", { ascending: false })
    .limit(200)
  return (data ?? []) as OrderOption[]
}

export default async function ManualReviewEntryPage() {
  const auth = await requireAdmin()
  if (auth.error) redirect("/login")

  const [products, orders] = await Promise.all([
    loadProducts(),
    loadDeliveredOrders(),
  ])

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/admin/marketing/reviews"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 size-4" />
          Back to reviews
        </Link>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          Add review manually
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use this for reviews that came in by phone, text, or email -
          when there&rsquo;s no magic-link submission to moderate. The review
          gets tied to a real delivered order, tagged{" "}
          <em>&ldquo;Verified buyer (manually entered)&rdquo;</em> in the
          audit log, and (by default) queued for moderation just like any
          customer-submitted review.
        </p>
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200">
          <strong>Type the reviewer&rsquo;s words verbatim.</strong>{" "}
          Don&rsquo;t edit, paraphrase, or soften the language - what
          the buyer said is what gets published. If a review has problems
          (personal info, libel, etc.), reject it from the moderation queue
          rather than editing it here.
        </div>
      </div>
      <ManualReviewEntryForm products={products} orders={orders} />
    </div>
  )
}
