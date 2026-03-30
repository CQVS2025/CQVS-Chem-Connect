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
  description: string | null
  type: string
  season: string | null
  discount_type: string
  discount_value: number
  min_order_value: number
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
    borderColor: "hover:ring-amber-400/30",
    badgeColor: "bg-amber-400/15 text-amber-400",
    period: "Nov - Jan",
    tagline: "Peak wash season = peak volume",
  },
  winter: {
    icon: Snowflake,
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "hover:ring-sky-400/30",
    badgeColor: "bg-sky-400/15 text-sky-400",
    period: "Jun - Aug",
    tagline: "Keep orders flowing in quieter months",
  },
  eofy: {
    icon: Receipt,
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "hover:ring-violet-400/30",
    badgeColor: "bg-violet-400/15 text-violet-400",
    period: "June",
    tagline: "Your accountant will thank you",
  },
}

const defaultVisual = {
  icon: Tag,
  color: "text-primary",
  bgColor: "bg-primary/10",
  borderColor: "hover:ring-primary/30",
  badgeColor: "bg-primary/15 text-primary",
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
    <section id="seasonal" className="scroll-mt-36 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10">
            <span className="mb-3 block text-sm font-bold tracking-widest text-primary">
              06
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Seasonal Promotions
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Seasonal deals that hit different. Timed offers across summer,
              winter, and EOFY.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : activePromos.length === 0 ? (
          <FadeIn>
            <div className="rounded-xl border border-white/5 bg-card/50 p-8 text-center backdrop-blur-sm">
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
                  ? `${new Date(promo.start_date).toLocaleDateString("en-AU", { month: "short" })} - ${new Date(promo.end_date).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`
                  : visual.period || "Limited time"

              return (
                <StaggerItem key={promo.id}>
                  <Card
                    className={cn(
                      "group h-full border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300",
                      "hover:shadow-xl hover:shadow-primary/5 hover:ring-1",
                      visual.borderColor
                    )}
                  >
                    <CardContent className="flex h-full flex-col p-5 sm:p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <Badge
                          className={cn("border-0 uppercase", visual.badgeColor)}
                        >
                          {promo.season || promo.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {displayPeriod}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "mb-4 flex size-12 items-center justify-center rounded-2xl",
                          visual.bgColor
                        )}
                      >
                        <Icon className={cn("size-6", visual.color)} />
                      </div>

                      <p className="mb-3 text-sm font-medium leading-relaxed text-foreground">
                        {promo.description || promo.name}
                      </p>

                      {promo.min_order_value > 0 && (
                        <p className="mt-auto text-xs text-muted-foreground">
                          Min. order: ${promo.min_order_value.toLocaleString()}
                        </p>
                      )}

                      {visual.tagline && (
                        <p className="mt-auto pt-2 text-xs italic text-muted-foreground">
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
