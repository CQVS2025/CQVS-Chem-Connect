import { notFound } from "next/navigation"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { loadShareLinkBySlug } from "@/lib/reviews/share-links"
import { ShareLinkSubmitForm } from "@/components/products/share-link-submit-form"

interface ProductInfo {
  id: string
  name: string
  slug: string
  image_url: string | null
}

/**
 * /reviews/share/[slug]
 *
 * Public landing page for share-link submissions. Anyone with the URL
 * can submit a review here. Reviews submitted via this path are tagged
 * source='public_link', verified_buyer=false. They go through the same
 * moderation queue as magic-link reviews but display with the muted
 * "Reviewer" badge and don't count toward the headline rating.
 */

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Leave a review · Chem Connect",
  // Never index share-link submission URLs - they're per-link entry points
  // not content pages.
  robots: { index: false, follow: false },
}

async function loadProductFromShareLink(slug: string): Promise<
  | { status: "ok"; product: ProductInfo; slug: string }
  | { status: "not_found" | "revoked" | "expired" | "exhausted" }
> {
  const supabase = createServiceRoleClient()
  const result = await loadShareLinkBySlug(supabase, slug)
  if (!result.ok) return { status: result.reason }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, slug, image_url")
    .eq("id", result.link.product_id)
    .maybeSingle()

  if (!product) return { status: "not_found" }
  return { status: "ok", product: product as ProductInfo, slug }
}

export default async function ReviewSharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!slug) notFound()

  const result = await loadProductFromShareLink(slug)

  if (result.status !== "ok") {
    const headline =
      result.status === "expired"
        ? "This review link has expired"
        : result.status === "revoked"
        ? "This review link is no longer active"
        : result.status === "exhausted"
        ? "This review link has reached its limit"
        : "We couldn’t find this review link"
    const message =
      result.status === "expired"
        ? "The link you used has passed its expiry date. If you'd still like to leave a review, please reach out to the team and we'll send you a fresh one."
        : result.status === "revoked"
        ? "The team revoked this link. If you were planning to leave a review, please reach out and we'll send you a new one."
        : result.status === "exhausted"
        ? "This link has been used the maximum number of times. Please contact us for a fresh one if you'd still like to leave a review."
        : "If you copied this link from a message or email, please double-check the URL. If it looks right, the link may have been revoked - reach out to the team and we'll get you a new one."

    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{headline}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    )
  }

  const { product } = result
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Public review
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Share your experience with {product.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A short rating and a few sentences about how the product worked for
          you. Optional photos. Your review will be moderated by the team
          before it appears on the product page.
        </p>
      </div>

      <ShareLinkSubmitForm
        slug={result.slug}
        productName={product.name}
        productSlug={product.slug}
      />
    </div>
  )
}
