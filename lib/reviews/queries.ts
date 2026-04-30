import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Public-facing query helpers for the product page. All return only
 * approved reviews — pending and rejected rows are filtered at the source.
 *
 * The ≥3-approved-reviews gate for AggregateRating JSON-LD lives at the
 * call site (see app/(marketplace)/products/[slug]/page.tsx). These
 * helpers just return the data; the gating policy is one line up.
 */

export interface PublicReview {
  id: string
  rating: number
  headline: string
  body: string
  display_name: string
  reviewer_city: string | null
  reviewer_state: string | null
  published_at: string
  photos: { id: string; public_url: string; position: number }[]
}

export interface PublicAggregate {
  count: number
  averageRating: number
  /** stars[5..1] = count of approved reviews at each rating. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/**
 * Get up to N approved reviews for a product, newest first. The limit
 * defaults to 10 because Schema.org Review[] arrays beyond 10 are ignored
 * by Google rich-result rendering anyway.
 */
export async function getApprovedReviewsForProduct(
  productId: string,
  limit = 10,
): Promise<PublicReview[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, rating, headline, body, display_name, reviewer_city, reviewer_state, published_at, review_photos(id, public_url, position)",
    )
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("published_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((r) => {
    const photos = ((r as { review_photos?: { id: string; public_url: string; position: number }[] }).review_photos ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
    return {
      id: r.id,
      rating: r.rating,
      headline: r.headline,
      body: r.body,
      display_name: r.display_name,
      reviewer_city: r.reviewer_city,
      reviewer_state: r.reviewer_state,
      published_at: r.published_at,
      photos,
    }
  })
}

/**
 * Aggregate stats across ALL approved reviews for the product (not just the
 * 10 displayed). Used for the average + count next to the buy button and
 * for the AggregateRating JSON-LD.
 */
export async function getApprovedReviewAggregate(
  productId: string,
): Promise<PublicAggregate | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("status", "approved")

  if (error || !data || data.length === 0) return null

  const distribution: PublicAggregate["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of data) {
    const k = r.rating as 1 | 2 | 3 | 4 | 5
    if (k >= 1 && k <= 5) distribution[k] += 1
  }
  const sum = data.reduce((acc, r) => acc + (r.rating as number), 0)
  return {
    count: data.length,
    averageRating: Math.round((sum / data.length) * 10) / 10,
    distribution,
  }
}
