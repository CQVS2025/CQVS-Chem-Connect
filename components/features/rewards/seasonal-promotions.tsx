"use client"

import { Sun, Snowflake, Receipt, Tag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"
import { cn } from "@/lib/utils"

interface Promotion {
  id: string
  name: string
  headline: string | null
  description: string | null
  type: string
  season: string | null
  discount_type: string
  discount_value: number
  promotion_type_detail: string | null
  min_order_value: number
  display_style: string | null
  fine_print: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

const seasonVisuals: Record<
  string,
  {
    icon: typeof Sun
    color: string
    bgColor: string
    borderColor: string
    badgeColor: string
    period: string
    tagline: string
  }
> = {
  summer: {
    icon: Sun,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "hover:border-amber-400/30",
    badgeColor: "border-amber-400/20 bg-amber-400/10 text-amber-400",
    period: "Nov - Jan",
    tagline: "Peak wash season = peak volume",
  },
  winter: {
    icon: Snowflake,
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "hover:border-sky-400/30",
    badgeColor: "border-sky-400/20 bg-sky-400/10 text-sky-400",
    period: "Jun - Aug",
    tagline: "Keep orders flowing in quieter months",
  },
  eofy: {
    icon: Receipt,
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "hover:border-violet-400/30",
    badgeColor: "border-violet-400/20 bg-violet-400/10 text-violet-400",
    period: "June",
    tagline: "Your accountant will thank you",
  },
}

const defaultVisual = {
  icon: Tag,
  color: "text-primary",
  bgColor: "bg-primary/10",
  borderColor: "hover:border-primary/30",
  badgeColor: "border-primary/20 bg-primary/10 text-primary",
  period: "",
  tagline: "",
}

export function SeasonalPromotions() {
  const { data: promotions, isLoading } = useQuery<Promotion[]>({
    queryKey: ["public-promotions"],
    queryFn: () => get<Promotion[]>("/admin/rewards/promotions"),
    staleTime: 300_000,
  })

  // Only show active promotions
  const activePromos = promotions?.filter((p) => p.is_active) ?? []

  return (
    <section id="seasonal" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              06 — Seasonal
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Seasonal Promotions
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Seasonal deals that hit different. Timed offers across summer,
              winter, and EOFY.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))}
          </div>
        ) : activePromos.length === 0 ? (
          <FadeIn>
            <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No active promotions right now. Check back soon!
              </p>
            </div>
          </FadeIn>
        ) : (
          <StaggerContainer
            className={cn(
              "grid gap-4",
              activePromos.length === 1
                ? "sm:grid-cols-1 max-w-md mx-auto"
                : activePromos.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-3"
            )}
          >
            {activePromos.map((promo) => {
              const visual =
                seasonVisuals[promo.season || ""] || defaultVisual
              const Icon = visual.icon
              const displayPeriod =
                promo.start_date && promo.end_date
                  ? `${new Date(promo.start_date).toLocaleDateString("en-AU", { month: "short" })} – ${new Date(promo.end_date).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`
                  : visual.period || "Limited time"

              return (
                <StaggerItem key={promo.id}>
                  <Card
                    className={cn(
                      "group h-full rounded-3xl border border-border/60 bg-card transition-all duration-300",
                      "hover:shadow-xl hover:shadow-primary/5",
                      visual.borderColor
                    )}
                  >
                    <CardContent className="flex h-full flex-col p-6 sm:p-7">
                      <div className="mb-5 flex items-center justify-between">
                        <Badge
                          className={cn("border rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider", visual.badgeColor)}
                        >
                          {promo.season || promo.type}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">
                          {displayPeriod}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20",
                          visual.bgColor
                        )}
                      >
                        <Icon className={cn("size-5", visual.color)} />
                      </div>

                      {/* Headline or fallback to description */}
                      {promo.headline && (
                        <p className="mb-1.5 text-base font-bold tracking-[-0.01em] text-foreground">
                          {promo.headline}
                        </p>
                      )}

                      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                        {promo.description || promo.name}
                      </p>

                      {promo.min_order_value > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Min. order: AUD {promo.min_order_value.toLocaleString()}
                        </p>
                      )}

                      {promo.fine_print && (
                        <p className="mt-2 text-[10px] italic text-muted-foreground/60">
                          {promo.fine_print}
                        </p>
                      )}

                      {visual.tagline && (
                        <p className="mt-auto pt-3 text-xs italic text-muted-foreground">
                          {visual.tagline}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        )}
      </div>
    </section>
  )
}
