"use client"

import Link from "next/link"
import {
  Crown,
  Award,
  Medal,
  Gift,
  Megaphone,
  CreditCard,
  ArrowRight,
  Stamp,
  TrendingUp,
  ExternalLink,
  Star,
} from "lucide-react"

import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"
import { useRewards, useReferrals, useRewardTiers } from "@/lib/hooks/use-rewards"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const tierVisuals: Record<
  string,
  {
    label: string
    icon: typeof Crown
    color: string
    bgColor: string
  }
> = {
  none: {
    label: "No Tier",
    icon: Gift,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
  bronze: {
    label: "Bronze",
    icon: Medal,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
  },
  silver: {
    label: "Silver",
    icon: Award,
    color: "text-slate-300",
    bgColor: "bg-slate-300/10",
  },
  gold: {
    label: "Gold",
    icon: Crown,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
  },
}

interface RebateTier {
  id: string
  min_annual_spend: number
  max_annual_spend: number | null
  rebate_percent: number
  sort_order: number
  is_active: boolean
}

export default function DashboardRewardsPage() {
  const { data: rewards, isLoading: rewardsLoading } = useRewards()
  const { data: referrals } = useReferrals()
  const { data: tiers } = useRewardTiers()
  const { data: rebateTiersRaw } = useQuery<RebateTier[]>({
    queryKey: ["public-rebates"],
    queryFn: () => get<RebateTier[]>("/admin/rewards/rebates"),
    staleTime: 300_000,
  })

  const rebateThresholds = (rebateTiersRaw ?? [])
    .filter((t) => t.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({
      min: t.min_annual_spend,
      max: t.max_annual_spend ?? Infinity,
      percent: t.rebate_percent,
    }))

  const tier = rewards?.current_tier || "none"
  const currentTierVisual = tierVisuals[tier] || tierVisuals.none
  const TierIcon = currentTierVisual.icon
  const monthlySpend = rewards?.current_month_spend ?? 0
  const annualSpend = rewards?.annual_spend ?? 0
  const totalStamps = rewards?.total_stamps ?? 0
  const referralCount = referrals?.length ?? 0
  const convertedReferrals =
    referrals?.filter((r) => r.status === "converted").length ?? 0
  const isAmbassador = convertedReferrals >= 5

  // Build tier thresholds from API data
  const tierThresholds = (tiers ?? [])
    .sort((a, b) => a.min_monthly_spend - b.min_monthly_spend)
    .map((t) => ({ name: t.name, threshold: t.min_monthly_spend, description: t.reward_description }))

  // Calculate next tier progress using dynamic thresholds
  const nextTier = tierThresholds.find((t) => monthlySpend < t.threshold)
  const nextTierThreshold = nextTier?.threshold ?? tierThresholds[tierThresholds.length - 1]?.threshold ?? 10000
  const progressPercent = nextTierThreshold > 0
    ? Math.min((monthlySpend / nextTierThreshold) * 100, 100)
    : 0

  // Build "no tier" description dynamically
  const lowestTier = tierThresholds[0]
  const noTierDescription = lowestTier
    ? `Spend $${lowestTier.threshold.toLocaleString()}/mo to unlock ${lowestTier.name.charAt(0).toUpperCase() + lowestTier.name.slice(1)}`
    : "Start ordering to unlock rewards"

  // Get current tier's reward description from API
  const currentTierData = tiers?.find((t) => t.name === tier)
  const tierDescription = tier === "none"
    ? noTierDescription
    : currentTierData?.reward_description ?? ""

  // Calculate rebate tier
  const currentRebate = rebateThresholds.find(
    (r) => annualSpend >= r.min && annualSpend <= r.max
  )
  const nextRebate = rebateThresholds.find((r) => annualSpend < r.min)
  const rebatePercent = currentRebate?.percent ?? 0
  const estimatedCredit = Math.round(annualSpend * (rebatePercent / 100))

  // Stamp card progress
  const stampsToFreeIBC = 10
  const currentCardStamps = totalStamps % stampsToFreeIBC
  const freeIBCsEarned = Math.floor(totalStamps / stampsToFreeIBC)
  const stampsRemaining = stampsToFreeIBC - currentCardStamps

  if (rewardsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Rewards & Loyalty
            </h1>
            {isAmbassador && (
              <Badge className="border-0 bg-amber-400/15 text-amber-400 gap-1">
                <Star className="size-3 fill-amber-400" />
                Ambassador
              </Badge>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">
            {isAmbassador
              ? "You're a CQVS Ambassador! Enjoy your permanent 5% discount on all orders."
              : "Track your rewards progress and see how much you're saving."}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/rewards">
            View All Programs
            <ExternalLink className="ml-2 size-3.5" />
          </Link>
        </Button>
      </div>

      {/* Tier Hero Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-primary/5" />
        <CardContent className="relative py-6 sm:py-8">
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
            <div
              className={cn(
                "flex size-16 shrink-0 items-center justify-center rounded-2xl sm:size-20",
                currentTierVisual.bgColor
              )}
            >
              <TierIcon
                className={cn("size-8 sm:size-10", currentTierVisual.color)}
              />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Badge
                    className={cn(
                      "border-0 capitalize",
                      currentTierVisual.bgColor,
                      currentTierVisual.color
                    )}
                  >
                    {currentTierVisual.label} Tier
                  </Badge>
                  {isAmbassador && (
                    <Badge className="border-0 bg-amber-400/15 text-amber-400 gap-1">
                      <Star className="size-3 fill-amber-400" />
                      Ambassador
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tierDescription}
                </p>
              </div>

              {/* Progress to next tier */}
              {nextTier && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Monthly spend: ${monthlySpend.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      ${nextTierThreshold.toLocaleString()} for{" "}
                      <span className="capitalize font-medium text-foreground">
                        {nextTier.name}
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-primary to-emerald-400 transition-all duration-1000"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ${Math.max(nextTierThreshold - monthlySpend, 0).toLocaleString()}{" "}
                    away from {nextTier.name}
                  </p>
                </div>
              )}

              {tier === "gold" && (
                <p className="text-sm font-medium text-primary">
                  You&apos;ve reached the highest tier! Enjoy all rewards.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  ${annualSpend.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Annual spend
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-sky-400/10">
                <CreditCard className="size-5 text-sky-400" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {currentCardStamps}/{stampsToFreeIBC}
                </p>
                <p className="text-xs text-muted-foreground">
                  {freeIBCsEarned > 0
                    ? `${freeIBCsEarned} free IBC${freeIBCsEarned > 1 ? "s" : ""} earned - ${stampsRemaining} to next`
                    : `Stamp card (${stampsRemaining} to free IBC)`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-violet-400/10">
                <Megaphone className="size-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xl font-bold">{referralCount}</p>
                <p className="text-xs text-muted-foreground">
                  {isAmbassador
                    ? "Ambassador - 5% permanent discount"
                    : `Referrals (${convertedReferrals} converted)`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10">
                <Gift className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {rebatePercent > 0 ? `${rebatePercent}%` : "--"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rebatePercent > 0
                    ? `~$${estimatedCredit.toLocaleString()} credit`
                    : "Annual rebate"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Programs */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Stamp Card Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stamp className="size-4 text-primary" />
              Loyalty Stamp Card
            </CardTitle>
            <CardDescription>
              Every 1000L IBC order = 1 stamp. 10 stamps = free IBC of TW Standard, TW Premium, or Eco Wash.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: stampsToFreeIBC }).map((_, i) => {
                const isFilled = i < currentCardStamps
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-bold transition-all",
                      isFilled
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-white/5 bg-muted/20 text-muted-foreground/40"
                    )}
                  >
                    {isFilled ? (
                      <Stamp className="size-4 text-primary" />
                    ) : (
                      i + 1
                    )}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {freeIBCsEarned > 0 && (
                <span className="block mb-1 font-medium text-primary">
                  {freeIBCsEarned} free IBC{freeIBCsEarned > 1 ? "s" : ""} earned! ({totalStamps} total stamps)
                </span>
              )}
              {currentCardStamps === 0 && freeIBCsEarned > 0
                ? "New card started - keep ordering!"
                : `${stampsRemaining} more stamps to free IBC (TW Standard, TW Premium, or Eco Wash)`}
            </p>
          </CardContent>
        </Card>

        {/* Referral Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-primary" />
              Referral Progress
            </CardTitle>
            <CardDescription>
              Refer sites and earn free products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  count: 1,
                  reward: "Free 200L drum of Truck Wash",
                  achieved: convertedReferrals >= 1,
                },
                {
                  count: 3,
                  reward: "Free freight for a quarter",
                  achieved: convertedReferrals >= 3,
                },
                {
                  count: 5,
                  reward: "Ambassador - 5% permanent discount",
                  achieved: convertedReferrals >= 5,
                },
              ].map((milestone) => (
                <div
                  key={milestone.count}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2",
                    milestone.achieved
                      ? "border-primary/20 bg-primary/5"
                      : "border-white/5 bg-muted/10"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                        milestone.achieved
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {milestone.count}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        milestone.achieved
                          ? "font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      {milestone.reward}
                    </span>
                  </div>
                  {milestone.achieved && (
                    <Badge className="border-0 bg-primary/15 text-primary">
                      Unlocked
                    </Badge>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {convertedReferrals} of your referrals have converted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Annual Rebate Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" />
            Annual Spend & Save Rebate
          </CardTitle>
          <CardDescription>
            Year-end store credit based on total annual spend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {rebateThresholds.map((rt) => {
              const isActive =
                annualSpend >= rt.min &&
                annualSpend <= (rt.max === Infinity ? 999999999 : rt.max)
              return (
                <div
                  key={rt.percent}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-center transition-all",
                    isActive
                      ? "border-primary/20 bg-primary/5"
                      : "border-white/5 bg-muted/10"
                  )}
                >
                  <p className="text-2xl font-bold text-primary">
                    {rt.percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${rt.min.toLocaleString()} -{" "}
                    {rt.max === Infinity
                      ? "$100k+"
                      : `$${rt.max.toLocaleString()}`}
                  </p>
                  {isActive && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      ~${estimatedCredit.toLocaleString()} credit
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {nextRebate && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              You&apos;re ${Math.max(nextRebate.min - annualSpend, 0).toLocaleString()}{" "}
              away from the {nextRebate.percent}% tier.
            </p>
          )}
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="font-semibold">Want to see all 8 reward programs?</p>
          <p className="text-sm text-muted-foreground">
            Volume tiers, bundles, seasonal promos, and more.
          </p>
        </div>
        <Button asChild>
          <Link href="/rewards">
            Explore All Rewards
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
