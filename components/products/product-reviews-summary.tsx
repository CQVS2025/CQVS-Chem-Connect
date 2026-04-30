import Link from "next/link"
import { Star } from "lucide-react"

import type { PublicAggregate } from "@/lib/reviews/queries"

/**
 * Compact "stars + count" summary, designed to sit right beside / under
 * the product title near the buy button. Per the implementation plan
 * (section 2.8): "Inline below the description AND a sticky summary
 * (stars + count) next to the buy button."
 *
 * Renders nothing if there are no approved reviews - keeps the buy area
 * clean for new products. The full reviews block lower on the page
 * handles the "No reviews yet" empty state.
 *
 * Anchor link jumps the buyer to the full reviews section if they click
 * the count.
 */
export function ProductReviewsSummary({
  aggregate,
  className,
}: {
  aggregate: PublicAggregate | null
  className?: string
}) {
  if (!aggregate || aggregate.count === 0) return null

  return (
    <Link
      href="#reviews"
      className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-card/60 ${className ?? ""}`}
      aria-label={`${aggregate.averageRating.toFixed(1)} stars, ${aggregate.count} reviews`}
    >
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={
              i < Math.round(aggregate.averageRating)
                ? "size-3.5 fill-amber-400 text-amber-400"
                : "size-3.5 text-muted-foreground/25"
            }
          />
        ))}
      </span>
      <span className="font-semibold">{aggregate.averageRating.toFixed(1)}</span>
      <span className="text-muted-foreground">
        &middot; {aggregate.count} review{aggregate.count === 1 ? "" : "s"}
      </span>
    </Link>
  )
}
