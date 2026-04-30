import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * Public-facing query helpers for the product page. All return only
 * approved reviews (pending and rejected rows are filtered at the source).
 *
 * Three query shapes, each driven by a different render concern:
 *
 *   1. getApprovedReviewsForProduct(productId, limit)
 *      - Verified-only. Used to feed the JSON-LD Review[] array.
 *      - Phase 2 decision: only verified reviews go into the rich-result
 *        schema. Public-link reviews appear on the page but are excluded
 *        here so a competitor can't game the search rating.
 *
 *   2. getReviewsForDisplay(productId, limit)
 *      - All approved (verified + public mixed by date). Used to render
 *        the visible review cards on the product page.
 *      - Each row carries verified_buyer so the UI can pick the right
 *        badge ("Verified buyer" emerald vs "Reviewer" muted grey).
 *
 *   3. getApprovedReviewAggregate(productId)
 *      - Verified-only count + average. Drives the headline chip near
 *        the buy button AND the AggregateRating JSON-LD math (gated at
 *        >=3 verified reviews on the call site).
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
  /** Phase 2: drives the badge on the card. true = green tick, false = grey. */
  verified_buyer: boolean
  photos: { id: string; public_url: string; position: number }[]
}

export interface PublicAggregate {
  count: number
  averageRating: number
  /** stars[5..1] = count of approved reviews at each rating. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

/**
 * Verified-only reviews for the JSON-LD Review[] array. Up to N reviews,
 * newest first. Default limit 10 because Google ignores Review[] beyond 10
 * for rich-result rendering.
 */
export async function getApprovedReviewsForProduct(
  productId: string,
  limit = 10,
): Promise<PublicReview[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, rating, headline, body, display_name, reviewer_city, reviewer_state, published_at, verified_buyer, review_photos(id, public_url, position)",
    )
    .eq("product_id", productId)
    .eq("status", "approved")
    .eq("verified_buyer", true)
    .order("published_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((r) => mapRow(r))
}

/**
 * All approved reviews (verified + public mixed) for the visible card list
 * on the product page. Newest first.
 */
export async function getReviewsForDisplay(
  productId: string,
  limit = 50,
): Promise<PublicReview[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, rating, headline, body, display_name, reviewer_city, reviewer_state, published_at, verified_buyer, review_photos(id, public_url, position)",
    )
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("published_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((r) => mapRow(r))
}

/**
 * Verified-only aggregate. Drives both the headline chip on the product
 * page and the AggregateRating JSON-LD. Returns null when there are no
 * verified reviews so the caller can hide the chip cleanly.
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
    .eq("verified_buyer", true)

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

// ---------------------------------------------------------------------------

interface RawReviewRow {
  id: string
  rating: number
  headline: string
  body: string
  display_name: string
  reviewer_city: string | null
  reviewer_state: string | null
  published_at: string
  verified_buyer: boolean | null
  review_photos?: { id: string; public_url: string; position: number }[]
}

function mapRow(r: RawReviewRow): PublicReview {
  const photos = (r.review_photos ?? [])
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
    verified_buyer: r.verified_buyer ?? true,
    photos,
  }
}
