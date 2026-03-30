"use client"

import { TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"
import { cn } from "@/lib/utils"

interface RebateTier {
  id: string
  min_annual_spend: number
  max_annual_spend: number | null
  rebate_percent: number
  sort_order: number
  is_active: boolean
}

const tierColors = [
  { color: "text-primary", bgColor: "bg-primary/10", borderColor: "hover:ring-primary/30" },
  { color: "text-sky-400", bgColor: "bg-sky-400/10", borderColor: "hover:ring-sky-400/30" },
  { color: "text-yellow-400", bgColor: "bg-yellow-400/10", borderColor: "hover:ring-yellow-400/30" },
]

interface AnnualRebatesProps {
  annualSpend?: number
}

export function AnnualRebates({ annualSpend = 0 }: AnnualRebatesProps) {
  const { data: rebateTiers, isLoading } = useQuery<RebateTier[]>({
    queryKey: ["public-rebates"],
    queryFn: () => get<RebateTier[]>("/admin/rewards/rebates"),
    staleTime: 300_000,
  })

  const activeTiers = (rebateTiers ?? [])
    .filter((t) => t.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)

  // Find next tier the user hasn't reached
  const nextTier = activeTiers.find((t) => annualSpend < t.min_annual_spend)
  const nextThreshold = nextTier?.min_annual_spend ?? activeTiers[activeTiers.length - 1]?.min_annual_spend ?? 100000
  const progressPercent = nextThreshold > 0
    ? Math.min((annualSpend / nextThreshold) * 100, 100)
    : 0
  const remaining = Math.max(nextThreshold - annualSpend, 0)

  // Current rebate info
  const currentRebate = [...activeTiers].reverse().find((t) => annualSpend >= t.min_annual_spend)
  const potentialCredit = nextTier
    ? Math.round(nextTier.min_annual_spend * (nextTier.rebate_percent / 100))
    : 0

  return (
    <section id="rebates" className="scroll-mt-36 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10">
            <span className="mb-3 block text-sm font-bold tracking-widest text-primary">
              05
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Annual Spend & Save Rebates
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Year-end store credit based on total spend. The more you buy, the
              more you get back.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : activeTiers.length === 0 ? (
          <FadeIn>
            <div className="rounded-xl border border-white/5 bg-card/50 p-8 text-center backdrop-blur-sm">
              <p className="text-sm text-muted-foreground">
                Rebate tiers are being configured. Check back soon!
              </p>
            </div>
          </FadeIn>
        ) : (
          <>
            <StaggerContainer
              className={cn(
                "mb-8 grid gap-4",
                activeTiers.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"
              )}
            >
              {activeTiers.map((tier, i) => {
                const visual = tierColors[i] || tierColors[0]
                const exampleSpend = tier.min_annual_spend
                const exampleCredit = Math.round(exampleSpend * (tier.rebate_percent / 100))
                return (
                  <StaggerItem key={tier.id}>
                    <Card
                      className={cn(
                        "group h-full border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300",
                        "hover:shadow-xl hover:shadow-primary/5 hover:ring-1",
                        visual.borderColor
                      )}
                    >
                      <CardContent className="p-5 sm:p-6">
                        <div
                          className={cn(
                            "mb-4 flex size-16 items-center justify-center rounded-2xl",
                            visual.bgColor
                          )}
                        >
                          <span className={cn("text-2xl font-bold", visual.color)}>
                            {tier.rebate_percent}%
                          </span>
                        </div>
                        <p className="mb-2 text-sm font-medium text-foreground">
                          ${tier.min_annual_spend.toLocaleString()} -{" "}
                          {tier.max_annual_spend
                            ? `$${tier.max_annual_spend.toLocaleString()}`
                            : "$100k+"}{" "}
                          annual spend
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Spend ${exampleSpend.toLocaleString()} -{">"} $
                          {exampleCredit.toLocaleString()} credit
                        </p>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                )
              })}
            </StaggerContainer>

            {/* Fine print */}
            <FadeIn delay={0.1}>
              <div className="mb-8 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                {[
                  "Store credit (not cash)",
                  "Valid 12 months",
                  "Calendar year (Jan-Dec)",
                  "Credited in January",
                ].map((note) => (
                  <span
                    key={note}
                    className="rounded-full border border-white/5 bg-muted/30 px-3 py-1"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </FadeIn>

            {/* Progress */}
            {annualSpend > 0 && nextTier && (
              <FadeIn delay={0.2}>
                <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-5 sm:p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <TrendingUp className="size-4 text-primary" />
                      <span className="text-sm font-semibold">Your progress</span>
                    </div>
                    <div className="mb-3 h-3 overflow-hidden rounded-full bg-muted/50">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-primary to-emerald-400 transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You&apos;ve spent{" "}
                      <span className="font-semibold text-foreground">
                        ${annualSpend.toLocaleString()}
                      </span>{" "}
                      this year. You&apos;re{" "}
                      <span className="font-semibold text-primary">
                        ${remaining.toLocaleString()}
                      </span>{" "}
                      away from the {nextTier.rebate_percent}% tier - that&apos;s $
                      {potentialCredit.toLocaleString()} in credit.
                    </p>
                  </CardContent>
                </Card>
              </FadeIn>
            )}
          </>
        )}
      </div>
    </section>
  )
}
