import { createHash } from "crypto"
import { notFound } from "next/navigation"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { verifyTokenSignature } from "@/lib/reviews/tokens"
import { ReviewSubmitForm } from "@/components/products/review-submit-form"

interface ProductInfo {
  id: string
  name: string
  slug: string
  image_url: string | null
}

/**
 * /reviews/submit?token=XYZ
 *
 * Public page that lands a buyer from the magic-link email. Server-side
 * we do a lightweight pre-check (signature + token row exists + not
 * already consumed) and pass product info to the form. Full validation
 * (rate-limit, status-gate, expiry) happens at submit time on the API
 * route - that's the only place that mutates state.
 */

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Leave a review · Chem Connect",
  robots: { index: false, follow: false }, // never index review-submit URLs
}

async function loadProductFromToken(
  token: string,
): Promise<{ status: "ok"; product: ProductInfo } | { status: "expired" | "consumed" | "invalid" }> {
  const decoded = verifyTokenSignature(token)
  if (!decoded) return { status: "invalid" }

  const supabase = createServiceRoleClient()
  const tokenHash = createHash("sha256").update(token).digest("hex")

  const { data: tokenRow } = await supabase
    .from("review_tokens")
    .select("expires_at, consumed_at, product_id")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (!tokenRow) return { status: "invalid" }
  if (tokenRow.consumed_at) return { status: "consumed" }
  if (new Date(tokenRow.expires_at) <= new Date()) return { status: "expired" }

  const { data: product } = await supabase
    .from("products")
    .select("id, name, slug, image_url")
    .eq("id", tokenRow.product_id)
    .maybeSingle()

  if (!product) return { status: "invalid" }
  return { status: "ok", product: product as ProductInfo }
}

export default async function ReviewSubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) notFound()

  const result = await loadProductFromToken(token)

  if (result.status !== "ok") {
    const headline =
      result.status === "expired"
        ? "This link has expired"
        : result.status === "consumed"
        ? "A review has already been submitted"
        : "We couldn’t recognise this link"
    const message =
      result.status === "expired"
        ? "Review links are valid for 60 days after we send them. If you'd still like to leave a review, reply to the email and we'll re-issue the link."
        : result.status === "consumed"
        ? "Thank you - looks like a review for this order has already come through. If you didn't submit it, reply to the email and we'll investigate."
        : "If you copied this link from an email, please double-check the URL. If it looks right, the link may have been corrupted in transit - reply to the email we sent you and we'll get you a fresh one."

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
          Two-minute review &middot; Verified buyer
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          How was the {product.name}?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Star rating, a short headline, and a few sentences about how the
          product worked for you. Optional photos. No login needed - we
          recognise you from the link in the email.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Your review will appear on the {product.name} product page after a
          quick policy check. We never edit what you write - positive,
          negative, or anywhere in between.
        </p>
      </div>

      <ReviewSubmitForm
        token={token}
        productName={product.name}
        productSlug={product.slug}
        productImageUrl={product.image_url}
      />
    </div>
  )
}
