"use client"

import { Crown, Award, Medal } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { Skeleton } from "@/components/ui/skeleton"
import { useRewardTiers } from "@/lib/hooks/use-rewards"
import { cn } from "@/lib/utils"

const tierVisuals: Record<
  string,
  {
    icon: typeof Crown
    color: string
    bgColor: string
    borderColor: string
    ringColor: string
    featured?: boolean
  }
> = {
  bronze: {
    icon: Medal,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    ringColor: "hover:border-amber-500/40",
  },
  silver: {
    icon: Award,
    color: "text-slate-300",
    bgColor: "bg-slate-300/10",
    borderColor: "border-slate-300/20",
    ringColor: "hover:border-slate-300/40",
    featured: true,
  },
  gold: {
    icon: Crown,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/20",
    ringColor: "hover:border-yellow-400/40",
  },
}

interface VolumeTiersProps {
  userSpend?: number
}

export function VolumeTiers({ userSpend = 0 }: VolumeTiersProps) {
  const { data: tiers, isLoading } = useRewardTiers()

  const sortedTiers = (tiers ?? []).sort(
    (a, b) => a.sort_order - b.sort_order
  )

  // Calculate progress to next tier
  const nextTier = sortedTiers.find(
    (t) => userSpend < t.min_monthly_spend
  )
  const nextTierThreshold = nextTier?.min_monthly_spend ?? sortedTiers[sortedTiers.length - 1]?.min_monthly_spend ?? 10000
  const progressPercent = nextTierThreshold > 0
    ? Math.min((userSpend / nextTierThreshold) * 100, 100)
    : 0
  const remaining = Math.max(nextTierThreshold - userSpend, 0)

  // Subtitle text for lowest tier
  const lowestTier = sortedTiers[0]
  const subtitleSpend = lowestTier
    ? `AUD ${lowestTier.min_monthly_spend.toLocaleString()}`
    : "AUD 2,000"

  return (
    <section id="volume-tiers" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              01 — Volume Tiers
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Volume Threshold Rewards
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Unlock recurring free product starting at just {subtitleSpend}/mo.
              The higher your volume, the more valuable the rewards become.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="mb-12 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : (
          <StaggerContainer className="mb-12 grid gap-4 sm:grid-cols-3">
            {sortedTiers.map((tier) => {
              const visual = tierVisuals[tier.name] || tierVisuals.bronze
              const Icon = visual.icon
              return (
                <StaggerItem key={tier.id}>
                  <Card
                    className={cn(
                      "relative overflow-hidden rounded-3xl border border-border/60 bg-card transition-all duration-300",
                      "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5",
                      visual.featured && "border-slate-300/20 shadow-lg shadow-slate-300/5"
                    )}
                  >
                    {visual.featured && (
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-300/40 to-transparent" />
                    )}
                    <CardContent className="p-6 sm:p-7">
                      {/* Tier header */}
                      <div className="mb-5 flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20",
                            visual.bgColor
                          )}
                        >
                          <Icon className={cn("size-5", visual.color)} />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">{tier.display_name}</h3>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Min. Spend
                          </p>
                        </div>
                      </div>

                      {/* Spend amount */}
                      <div className="mb-4">
                        <span className="text-3xl font-bold tracking-[-0.02em] text-foreground">
                          AUD {tier.min_monthly_spend.toLocaleString()}+
                        </span>
                        <span className="ml-1.5 text-sm text-muted-foreground">
                          /mo
                        </span>
                      </div>

                      {/* Reward description */}
                      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                        {tier.reward_description}
                      </p>

                      {/* Savings chip */}
                      <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          You Save
                        </p>
                        <p className="text-xl font-bold text-primary">
                          ~AUD {tier.estimated_monthly_savings.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground">
                            /month
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        )}

        {/* Progress bar - shown if user has spend data */}
        {userSpend > 0 && nextTier && (
          <FadeIn delay={0.2}>
            <Card className="rounded-3xl border border-border/60 bg-card">
              <CardContent className="p-6 sm:p-7">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Your progress to {nextTier.display_name}
                  </h3>
                  <span className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    AUD {userSpend.toLocaleString()} / AUD {nextTierThreshold.toLocaleString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-primary to-emerald-400 transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  You&apos;re{" "}
                  <span className="font-semibold text-primary">
                    AUD {remaining.toLocaleString()}
                  </span>{" "}
                  away from {nextTier.display_name} — {nextTier.reward_description.toLowerCase()}.
                </p>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* Persuasion text */}
        <FadeIn delay={0.3}>
          <p className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            Spending across two suppliers? Consolidate with CQVS and unlock
            tier rewards — free product, free freight, and more every month.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
