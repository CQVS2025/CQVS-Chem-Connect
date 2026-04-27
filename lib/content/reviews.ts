/**
 * Customer reviews - sample / seed dataset.
 *
 * ⚠️  IMPORTANT - READ BEFORE SHIPPING TO PRODUCTION  ⚠️
 *
 * The reviews in this file are SEED DATA, not real customer feedback.
 * They exist so the review UI + AggregateRating schema can be developed,
 * tested, and demoed before any real reviews are collected.
 *
 * Showing seed reviews to real shoppers is:
 *   1. A Google review-policy violation. Risk: site-wide manual action,
 *      removal from Google Shopping / rich results, full deindexation.
 *   2. Misleading conduct under s18 of the Australian Consumer Law.
 *      Risk: ACCC complaint, potential penalty.
 *   3. A trust hit if buyers spot the pattern (these are B2B buyers; many
 *      of them know what real industrial-chemical reviews sound like).
 *
 * Visibility is gated on `NEXT_PUBLIC_REVIEWS_VISIBLE`. Default is OFF.
 * Once real reviews start arriving (post-order email collection wired
 * through the GHL workflow):
 *   1. Replace this seed array with the real review data.
 *   2. Flip `NEXT_PUBLIC_REVIEWS_VISIBLE=true` in production env.
 *   3. Delete this comment block - it'll be obsolete.
 */

export interface CustomerReview {
  /** Stable ID. Use a UUID once reviews come from the database. */
  id: string
  /** Slug of the product the review applies to (matches lib/data/products.ts). */
  productSlug: string
  /** Reviewer display name. Real reviews would use first name + last initial. */
  authorName: string
  /** Buyer location - adds local-search trust. */
  authorLocation: string
  /** 1-5. Whole numbers only for the seed set. */
  rating: 1 | 2 | 3 | 4 | 5
  /** Headline of the review. */
  title: string
  /** Body - keep under ~120 words for clean rendering. */
  body: string
  /** ISO date the review was submitted. */
  publishedAt: string
  /** Verification flag - true if the reviewer was an actual past purchaser
   *  (verified by order ID at submission time). Sample data sets this true
   *  to mirror the production shape. */
  verifiedPurchase: boolean
  /** Internal flag - flips to false / removed once real reviews replace
   *  the seed. The UI also greys out badges when this is true. */
  isSeed: boolean
}

export const REVIEWS: CustomerReview[] = [
  {
    id: "seed-001",
    productSlug: "green-acid-replacement",
    authorName: "Marcus T.",
    authorLocation: "Brisbane, QLD",
    rating: 5,
    title: "Best truck-mixer cleaner we've used",
    body: "Switched from straight HCl to this last quarter and haven't looked back. Cuts agi residue just as well, way less fume in the wash bay, drivers don't fight it. Ordered another IBC last week.",
    publishedAt: "2026-03-15",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-002",
    productSlug: "green-acid-replacement",
    authorName: "Sarah K.",
    authorLocation: "Dandenong, VIC",
    rating: 5,
    title: "Plant manager-approved",
    body: "Run two batching plants in south-east Melbourne. Tried this on a smaller drum order first to see how it stacked up. Performance is comparable to what we used to get from our old supplier and the freight came faster than quoted. Now standard across both sites.",
    publishedAt: "2026-02-28",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-003",
    productSlug: "adblue-def",
    authorName: "Jared P.",
    authorLocation: "Perth, WA",
    rating: 5,
    title: "Reliable AdBlue supply for our fleet",
    body: "Manage a regional fleet of 12 prime movers. AdBlue arrives on time every fortnight and the IBC pricing is sharper than we were getting through the local distributor. Easy reorder.",
    publishedAt: "2026-03-22",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-004",
    productSlug: "adblue-def",
    authorName: "Linda M.",
    authorLocation: "Newcastle, NSW",
    rating: 4,
    title: "Good product, freight was a day late",
    body: "AdBlue itself is on-spec, no issues with the fluid. First delivery from Cardiff was a day later than quoted but the team flagged it ahead of time and credited the freight. Would buy again.",
    publishedAt: "2026-04-02",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-005",
    productSlug: "eco-wash",
    authorName: "Andrew R.",
    authorLocation: "Adelaide, SA",
    rating: 5,
    title: "Strong workshop degreaser",
    body: "We use this in our heavy-vehicle workshop. Cuts grease and brake dust without trashing the floor coating. Pricing per litre at the IBC level is unbeatable.",
    publishedAt: "2026-03-08",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-006",
    productSlug: "eco-wash",
    authorName: "Priya N.",
    authorLocation: "Geelong, VIC",
    rating: 4,
    title: "Solid all-rounder",
    body: "Smell is mild, foaming is controlled, dilutes 1:20 nicely. Mostly using it for trailer wash-down. Only mark down is I'd like to see a 5L size for smaller jobs - 20L is overkill for our backup ute.",
    publishedAt: "2026-03-30",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-007",
    productSlug: "green-acid-replacement",
    authorName: "Tom B.",
    authorLocation: "Gold Coast, QLD",
    rating: 4,
    title: "Solid acid replacement",
    body: "Was sceptical about non-DG performance vs HCl. Tried a 20L on a particularly stubborn agi build-up and it handled it. Not as aggressive as HCl on heavy long-term scale but for daily wash-down it's spot-on.",
    publishedAt: "2026-04-10",
    verifiedPurchase: true,
    isSeed: true,
  },
  {
    id: "seed-008",
    productSlug: "adblue-def",
    authorName: "Daniel C.",
    authorLocation: "Melbourne, VIC",
    rating: 5,
    title: "Smooth ordering, no quote runaround",
    body: "Refreshing not having to chase a quote for a standard product. Just AUD pricing on the page, in the cart, on the invoice. Ordered two IBCs Tuesday morning, on the dock Thursday. That's the dream.",
    publishedAt: "2026-04-05",
    verifiedPurchase: true,
    isSeed: true,
  },
]

/**
 * Visibility flag. Reviews only render when this is `true` AND the env
 * var `NEXT_PUBLIC_REVIEWS_VISIBLE` is set to "true" at build time.
 *
 * Production default: OFF (showing seed data is a policy violation).
 */
export const REVIEWS_VISIBLE =
  process.env.NEXT_PUBLIC_REVIEWS_VISIBLE === "true"

export function getReviewsForProduct(productSlug: string): CustomerReview[] {
  if (!REVIEWS_VISIBLE) return []
  return REVIEWS.filter((r) => r.productSlug === productSlug)
}

export interface ReviewAggregate {
  count: number
  averageRating: number
  /** Distribution histogram: stars[5..1] = count of reviews at each rating. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export function getReviewAggregate(
  productSlug: string,
): ReviewAggregate | null {
  const reviews = getReviewsForProduct(productSlug)
  if (reviews.length === 0) return null
  const distribution: ReviewAggregate["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
  for (const r of reviews) distribution[r.rating] += 1
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return {
    count: reviews.length,
    averageRating: Math.round((sum / reviews.length) * 10) / 10,
    distribution,
  }
}
