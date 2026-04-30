import { Quote, ShieldCheck, Star, User } from "lucide-react"

import type {
  PublicAggregate,
  PublicReview,
} from "@/lib/reviews/queries"

interface ProductReviewsProps {
  /** Verified-only aggregate. Null when 0 verified reviews exist. */
  aggregate: PublicAggregate | null
  /** All approved reviews (verified + public mixed by date) for display. */
  reviews: PublicReview[]
  productName: string
}

/**
 * Customer reviews block for the product detail page.
 *
 * Phase 2 split (per docs/Public-Review-Share-Link-Phase-2-Spec.html sec 9):
 *
 *   - Header chip (stars + count) is VERIFIED-ONLY. It only renders when
 *     aggregate is non-null (>=1 verified review).
 *   - Card list shows ALL approved reviews (verified + public mixed by
 *     date). Each card's badge depends on review.verified_buyer:
 *       - true  -> "Verified" emerald pill with ShieldCheck icon
 *       - false -> "Reviewer" muted grey pill, no icon
 *
 * Edge-case render branches (spec sec 9.2):
 *
 *   1. 0 verified + 0 public  -> empty state "No reviews yet - be the first"
 *   2. 0 verified + >=1 public -> header without chip + "No verified buyer
 *                                 reviews yet" message + cards (all public)
 *   3. >=1 verified + any public -> header WITH verified chip + cards
 *
 * Photos appear inline on each card with click-through to the full image.
 *
 * Server Component compatible. Marquee animation is pure CSS keyframes.
 */
export function ProductReviews({
  aggregate,
  reviews,
  productName,
}: ProductReviewsProps) {
  const hasAnyReviews = reviews.length > 0
  const hasVerifiedAggregate = aggregate !== null && aggregate.count > 0
  const verifiedCount = aggregate?.count ?? 0
  const publicCount = reviews.filter((r) => !r.verified_buyer).length

  // Branch 1: nothing approved at all - the empty state.
  if (!hasAnyReviews) {
    return (
      <section className="mt-12 border-t border-border/50 pt-10">
        <header className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Reviews
          </p>
          <h2 className="text-2xl font-bold tracking-tight">
            What buyers say
          </h2>
        </header>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-12 text-center">
          <Star className="size-7 text-muted-foreground/40" />
          <p className="text-sm font-medium">No reviews yet - be the first.</p>
          <p className="text-xs text-muted-foreground">
            Once a buyer leaves a review for {productName}, it&rsquo;ll appear here.
          </p>
        </div>
      </section>
    )
  }

  // Branches 2 + 3: at least one review exists. Marquee at >=3 total cards
  // for visual rhythm; inline grid below 3.
  const useMarquee = reviews.length >= 3
  const loopReviews = useMarquee ? [...reviews, ...reviews] : reviews
  const durationSeconds = Math.min(80, Math.max(24, reviews.length * 8))

  return (
    <section className="mt-12 border-t border-border/50 pt-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Reviews
          </p>
          <h2 className="text-2xl font-bold tracking-tight">
            What buyers say
          </h2>
        </div>
        {hasVerifiedAggregate && aggregate && (
          <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card px-4 py-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={
                    i < Math.round(aggregate.averageRating)
                      ? "size-4 fill-amber-400 text-amber-400"
                      : "size-4 text-muted-foreground/25"
                  }
                />
              ))}
            </div>
            <span className="text-sm font-medium">
              {aggregate.averageRating.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              &middot; {aggregate.count} verified review
              {aggregate.count === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </header>

      {/* Branch 2 banner: only public reviews exist, no verified yet.
          Honest signal so a careful reader knows the displayed reviews
          haven't yet contributed to a verified-buyer rating. */}
      {!hasVerifiedAggregate && publicCount > 0 && (
        <div className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">No verified buyer reviews yet.</strong>{" "}
          The reviews below are from public reviewers - they don&rsquo;t count
          toward the product&rsquo;s star rating average.
        </div>
      )}

      {useMarquee ? (
        <div className="reviews-marquee-container relative overflow-hidden">
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
                key={`${review.id}-${idx}`}
                aria-hidden={idx >= reviews.length}
              >
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} expanded />
            </li>
          ))}
        </ul>
      )}

      {/* Footer note when both kinds are present - quietly explains the
          mixed list without making it feel like a disclaimer. */}
      {hasVerifiedAggregate && publicCount > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          The star rating is based on {verifiedCount} verified-buyer review
          {verifiedCount === 1 ? "" : "s"}. The list also includes {publicCount}{" "}
          public reviewer{publicCount === 1 ? "" : "s"} for context - those don&rsquo;t
          contribute to the average.
        </p>
      )}

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
        .reviews-marquee-container:hover .reviews-marquee-track,
        .reviews-marquee-container:focus-within .reviews-marquee-track {
          animation-play-state: paused;
        }
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

function ReviewCard({
  review,
  expanded = false,
}: {
  review: PublicReview
  expanded?: boolean
}) {
  const initials =
    review.display_name
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "?"

  const formattedDate = new Date(review.published_at).toLocaleDateString(
    "en-AU",
    { day: "numeric", month: "short", year: "numeric" },
  )

  const location = [review.reviewer_city, review.reviewer_state]
    .filter(Boolean)
    .join(", ")

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        expanded ? "" : "w-[300px] flex-shrink-0 sm:w-[340px]"
      }`}
    >
      <Quote
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-2 size-16 rotate-12 text-primary/5 transition-colors group-hover:text-primary/10"
      />

      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={
              i < review.rating
                ? "size-3.5 fill-amber-400 text-amber-400"
                : "size-3.5 text-muted-foreground/20"
            }
          />
        ))}
      </div>

      <h3
        className={`mt-3 text-sm font-semibold tracking-tight ${
          expanded ? "" : "line-clamp-1"
        }`}
      >
        {review.headline}
      </h3>

      <p
        className={`mt-2 flex-1 text-xs leading-relaxed text-muted-foreground ${
          expanded ? "whitespace-pre-line" : "line-clamp-4"
        }`}
      >
        {review.body}
      </p>

      {review.photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {review.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a
              key={p.id}
              href={p.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block size-16 overflow-hidden rounded-md border border-border/40"
            >
              <img
                src={p.public_url}
                alt=""
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-t border-border/40 pt-3">
        <div
          aria-hidden
          className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-[10px] font-bold text-primary"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {review.display_name}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {location ? `${location} · ${formattedDate}` : formattedDate}
          </p>
        </div>
        {review.verified_buyer ? (
          <span
            className="flex flex-shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
            title="Verified buyer - this reviewer placed an order with Chem Connect."
          >
            <ShieldCheck className="size-3" />
            Verified
          </span>
        ) : (
          <span
            className="flex flex-shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
            title="This reviewer used the product but isn't tied to a Chem Connect order. Public reviews don't count toward the star rating."
          >
            <User className="size-3" />
            Reviewer
          </span>
        )}
      </div>
    </article>
  )
}
