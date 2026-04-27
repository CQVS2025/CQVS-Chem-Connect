import { Quote, ShieldCheck, Star } from "lucide-react"

import {
  REVIEWS_VISIBLE,
  getReviewAggregate,
  getReviewsForProduct,
  type CustomerReview,
} from "@/lib/content/reviews"

interface ProductReviewsProps {
  productSlug: string
}

/**
 * Customer reviews block for the product detail page.
 *
 * Renders nothing when:
 *   - NEXT_PUBLIC_REVIEWS_VISIBLE !== "true" (global kill switch), or
 *   - this product has zero approved reviews.
 *
 * When it does render, the layout is an infinite right-to-left marquee
 * of compact review cards. Implementation notes:
 *
 * 1. Pure CSS keyframes - no JS observer, no rAF loop, smooth on every
 *    device. Server Component compatible.
 * 2. The reviews array is duplicated `[...r, ...r]` and the track is
 *    translated from 0 to -50% over the duration. Because the second
 *    half is identical to the first, there's no visible "jump" when the
 *    animation loops - it just appears to scroll forever.
 * 3. Animation duration scales with review count (~8s per review,
 *    clamped 24s-80s) so 3 reviews don't whip past and 30 don't crawl.
 * 4. Pauses on hover so users can actually read a card that catches
 *    their eye.
 * 5. Honours `prefers-reduced-motion: reduce` - reduces to a static
 *    horizontal scroll for users who've opted out of animation.
 */
export function ProductReviews({ productSlug }: ProductReviewsProps) {
  if (!REVIEWS_VISIBLE) return null

  const reviews = getReviewsForProduct(productSlug)
  const aggregate = getReviewAggregate(productSlug)

  // No approved reviews for this product yet - render absolutely
  // nothing (no header, no card, no divider). Per client direction:
  // don't surface the empty state, only the populated state.
  if (reviews.length === 0 || !aggregate) return null

  // Duplicate so the marquee loops seamlessly. Translating the track
  // from 0% to -50% lands the duplicated half exactly where the original
  // half started - visually indistinguishable, no jump.
  const loopReviews = [...reviews, ...reviews]

  // Tune the speed to the volume so 3 reviews don't blur and 30 don't
  // crawl. Constant per-card pacing → consistent reading rhythm.
  const durationSeconds = Math.min(80, Math.max(24, reviews.length * 8))

  return (
    <section className="mt-12 border-t border-border/50 pt-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Reviews
          </p>
          <h2 className="text-2xl font-bold tracking-tight">
            What buyers say
          </h2>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card px-4 py-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`size-4 ${
                  i < Math.round(aggregate.averageRating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/25"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">
            {aggregate.averageRating.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">
            · {aggregate.count} review{aggregate.count === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="reviews-marquee-container relative overflow-hidden">
        {/* Edge fades - content gracefully appears / disappears at the
            sides instead of hard-cutting at the container boundary. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-16 bg-gradient-to-r from-background via-background/80 to-transparent sm:w-24"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 bg-gradient-to-l from-background via-background/80 to-transparent sm:w-24"
        />

        <ul
          className="reviews-marquee-track flex gap-4 py-2"
          style={
            {
              "--reviews-duration": `${durationSeconds}s`,
            } as React.CSSProperties
          }
        >
          {loopReviews.map((review, idx) => (
            <li
              // Index is required: each review appears twice in the array.
              // aria-hidden on the second pass so screen readers don't
              // re-announce the same content.
              key={`${review.id}-${idx}`}
              aria-hidden={idx >= reviews.length}
            >
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>

      {/* Component-scoped marquee animation. Lives here (not globals)
          so the rest of the platform stays clean of unused keyframes. */}
      <style>{`
        @keyframes reviews-marquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        .reviews-marquee-track {
          width: max-content;
          animation: reviews-marquee var(--reviews-duration, 40s) linear infinite;
          will-change: transform;
        }
        /* Pause when the user hovers anywhere in the marquee - gives
           them time to actually read the card that drew their eye. */
        .reviews-marquee-container:hover .reviews-marquee-track,
        .reviews-marquee-container:focus-within .reviews-marquee-track {
          animation-play-state: paused;
        }
        /* Honour the user's OS-level animation preference. */
        @media (prefers-reduced-motion: reduce) {
          .reviews-marquee-track {
            animation: none;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
          }
        }
      `}</style>
    </section>
  )
}

/**
 * Single review card. ~340px wide, fixed line-clamp on the body so all
 * cards line up to the same height - important for a marquee where the
 * eye is tracking horizontal motion (variable heights would feel jumpy).
 */
function ReviewCard({ review }: { review: CustomerReview }) {
  const initials =
    review.authorName
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "?"

  const formattedDate = new Date(review.publishedAt).toLocaleDateString(
    "en-AU",
    { day: "numeric", month: "short", year: "numeric" },
  )

  return (
    <article className="group relative flex h-full w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:w-[340px]">
      {/* Decorative quote mark - subtle, sits behind the content */}
      <Quote
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-2 size-16 rotate-12 text-primary/5 transition-colors group-hover:text-primary/10"
      />

      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-3.5 ${
              i < review.rating
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/20"
            }`}
          />
        ))}
      </div>

      {/* Title - clamped to 1 line for layout consistency */}
      <h3 className="mt-3 line-clamp-1 text-sm font-semibold tracking-tight">
        {review.title}
      </h3>

      {/* Body - clamped to 4 lines so every card is the same height */}
      <p className="mt-2 line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground">
        {review.body}
      </p>

      {/* Footer - avatar initial, name, location, date, verified mark */}
      <div className="mt-4 flex items-center gap-3 border-t border-border/40 pt-3">
        <div
          aria-hidden
          className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-[10px] font-bold text-primary"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {review.authorName}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {review.authorLocation} · {formattedDate}
          </p>
        </div>
        {review.verifiedPurchase && (
          <span
            className="flex flex-shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
            title="Verified buyer"
          >
            <ShieldCheck className="size-3" />
            Verified
          </span>
        )}
      </div>
    </article>
  )
}
