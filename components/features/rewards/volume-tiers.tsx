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
    ringColor: "hover:ring-amber-500/30",
  },
  silver: {
    icon: Award,
    color: "text-slate-300",
    bgColor: "bg-slate-300/10",
    borderColor: "border-slate-300/20",
    ringColor: "hover:ring-slate-300/30",
    featured: true,
  },
  gold: {
    icon: Crown,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/20",
    ringColor: "hover:ring-yellow-400/30",
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
    <section id="volume-tiers" className="scroll-mt-36 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10">
            <span className="mb-3 block text-sm font-bold tracking-widest text-primary">
              01
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Volume Threshold Rewards
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Unlock recurring free product starting at just {subtitleSpend}/mo.
              The higher your volume, the more valuable the rewards become.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="mb-12 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
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
                      "relative overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300",
                      "hover:shadow-xl hover:shadow-primary/5",
                      "hover:ring-1",
                      visual.ringColor,
                      visual.featured && "ring-1 ring-slate-300/20"
                    )}
                  >
                    <CardContent className="p-5 sm:p-6">
                      {/* Tier header */}
                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-10 items-center justify-center rounded-xl",
                            visual.bgColor
                          )}
                        >
                          <Icon className={cn("size-5", visual.color)} />
                        </div>
                        <div>
                          <h3 className="font-bold">{tier.display_name}</h3>
                          <p className="text-xs text-muted-foreground">
                            MIN. SPEND
                          </p>
                        </div>
                      </div>

                      {/* Spend amount */}
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-foreground">
                          AUD {tier.min_monthly_spend.toLocaleString()}+
                        </span>
                        <span className="ml-1 text-sm text-muted-foreground">
                          /mo
                        </span>
                      </div>

                      {/* Reward description */}
                      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                        {tier.reward_description}
                      </p>

                      {/* Savings */}
                      <div className="rounded-xl border border-white/5 bg-muted/30 px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">
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
            <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Your progress to {nextTier.display_name}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    AUD {userSpend.toLocaleString()} / AUD {nextTierThreshold.toLocaleString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-4 h-3 overflow-hidden rounded-full bg-muted/50">
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
                  away from {nextTier.display_name} - {nextTier.reward_description.toLowerCase()}.
                </p>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* Persuasion text */}
        <FadeIn delay={0.3}>
          <p className="mt-6 rounded-xl border border-primary/10 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            Spending across two suppliers? Consolidate with CQVS and unlock
            tier rewards - free product, free freight, and more every month.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
