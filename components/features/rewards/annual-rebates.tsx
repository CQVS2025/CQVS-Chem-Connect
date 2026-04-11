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
  { color: "text-primary", bgColor: "bg-primary/10", borderColor: "border-primary/20", hover: "hover:border-primary/40" },
  { color: "text-sky-400", bgColor: "bg-sky-400/10", borderColor: "border-sky-400/20", hover: "hover:border-sky-400/40" },
  { color: "text-yellow-400", bgColor: "bg-yellow-400/10", borderColor: "border-yellow-400/20", hover: "hover:border-yellow-400/40" },
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
    <section id="rebates" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              05 - Rebates
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Annual Spend &amp; Save Rebates
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Year-end store credit based on total spend. The more you buy, the
              more you get back.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 rounded-3xl" />
            ))}
          </div>
        ) : activeTiers.length === 0 ? (
          <FadeIn>
            <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
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
                        "group h-full rounded-3xl border border-border/60 bg-card transition-all duration-300",
                        "hover:shadow-xl hover:shadow-primary/5",
                        visual.hover
                      )}
                    >
                      <CardContent className="p-6 sm:p-7">
                        <div
                          className={cn(
                            "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border",
                            visual.bgColor,
                            visual.borderColor
                          )}
                        >
                          <span className={cn("text-2xl font-bold", visual.color)}>
                            {tier.rebate_percent}%
                          </span>
                        </div>
                        <p className="mb-2 text-sm font-semibold text-foreground">
                          AUD {tier.min_annual_spend.toLocaleString()} -{" "}
                          {tier.max_annual_spend
                            ? `AUD ${tier.max_annual_spend.toLocaleString()}`
                            : "AUD 100k+"}{" "}
                          annual spend
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Spend AUD {exampleSpend.toLocaleString()} → AUD {exampleCredit.toLocaleString()} credit
                        </p>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                )
              })}
            </StaggerContainer>

            {/* Fine print chips */}
            <FadeIn delay={0.1}>
              <div className="mb-8 flex flex-wrap justify-center gap-2.5">
                {[
                  "Store credit (not cash)",
                  "Valid 12 months",
                  "Calendar year (Jan-Dec)",
                  "Credited in January",
                ].map((note) => (
                  <span
                    key={note}
                    className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </FadeIn>

            {/* Progress */}
            {annualSpend > 0 && nextTier && (
              <FadeIn delay={0.2}>
                <Card className="rounded-3xl border border-border/60 bg-card">
                  <CardContent className="p-6 sm:p-7">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                        <TrendingUp className="size-5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Your progress</span>
                    </div>
                    <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-primary to-emerald-400 transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You&apos;ve spent{" "}
                      <span className="font-semibold text-foreground">
                        AUD {annualSpend.toLocaleString()}
                      </span>{" "}
                      this year. You&apos;re{" "}
                      <span className="font-semibold text-primary">
                        AUD {remaining.toLocaleString()}
                      </span>{" "}
                      away from the {nextTier.rebate_percent}% tier - that&apos;s AUD {potentialCredit.toLocaleString()} in credit.
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
