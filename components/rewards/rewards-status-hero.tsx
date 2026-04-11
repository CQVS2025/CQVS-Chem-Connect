"use client"

import Link from "next/link"
import {
  Gift,
  Crown,
  Award,
  Medal,
  ArrowRight,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn, BlurIn } from "@/components/shared/motion"
import { useRewards, useRewardTiers } from "@/lib/hooks/use-rewards"
import { useUser } from "@/lib/hooks/use-auth"

const tierMeta: Record<string, { icon: typeof Crown; gradient: string; label: string }> = {
  gold: {
    icon: Crown,
    gradient: "from-amber-400 via-yellow-300 to-amber-500",
    label: "Gold Member",
  },
  silver: {
    icon: Award,
    gradient: "from-slate-300 via-gray-200 to-slate-400",
    label: "Silver Member",
  },
  bronze: {
    icon: Medal,
    gradient: "from-orange-400 via-amber-500 to-orange-600",
    label: "Bronze Member",
  },
}

export function RewardsStatusHero() {
  const { user, loading: authLoading } = useUser()
  const { data: rewards } = useRewards()
  const { data: tiers } = useRewardTiers()

  const sortedTiers = (tiers ?? []).sort((a, b) => a.sort_order - b.sort_order)

  if (authLoading) return null

  // LOGGED-OUT: generic value prop hero
  if (!user) {
    return <LoggedOutHero tiers={sortedTiers} />
  }

  // LOGGED-IN: personalised status dashboard
  const currentTier = rewards?.current_tier ?? "bronze"
  const monthlySpend = rewards?.current_month_spend ?? 0
  const meta = tierMeta[currentTier] ?? tierMeta.bronze
  const TierIcon = meta.icon

  // Progress to next tier
  const currentTierIdx = sortedTiers.findIndex(
    (t) => t.name.toLowerCase() === currentTier,
  )
  const nextTier =
    currentTierIdx >= 0 && currentTierIdx < sortedTiers.length - 1
      ? sortedTiers[currentTierIdx + 1]
      : null
  const progressTarget = nextTier?.min_monthly_spend ?? sortedTiers[sortedTiers.length - 1]?.min_monthly_spend ?? 10000
  const progressPercent = Math.min(
    (monthlySpend / progressTarget) * 100,
    100,
  )
  const remaining = Math.max(progressTarget - monthlySpend, 0)

  return (
    <section className="relative overflow-hidden border-b border-border/60 px-4 pt-12 pb-12 sm:px-6 sm:pt-16 sm:pb-16 lg:px-8">
      {/* Decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[800px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <FadeIn>
          <div className="flex flex-col items-center text-center">
            {/* Tier badge */}
            <div
              className={`mb-6 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r px-5 py-2 shadow-lg ${meta.gradient}`}
            >
              <TierIcon className="size-5 text-foreground" />
              <span className="text-sm font-bold tracking-tight text-foreground">
                {meta.label}
              </span>
            </div>

            <h1 className="text-3xl font-black tracking-[-0.025em] text-foreground sm:text-4xl lg:text-5xl">
              Welcome back.
              <br />
              <span className="text-primary">You&apos;re saving real money.</span>
            </h1>

            {/* Progress card */}
            <div className="mt-10 w-full max-w-xl rounded-3xl border border-border/60 bg-card p-6 shadow-lg sm:p-8">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold capitalize text-foreground">
                  {currentTier} tier
                </span>
                {nextTier && (
                  <span className="text-muted-foreground">
                    Next:{" "}
                    <span className="font-semibold capitalize text-foreground">
                      {nextTier.display_name}
                    </span>
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">
                    AUD {monthlySpend.toLocaleString()}
                  </span>{" "}
                  this month
                </span>
                {remaining > 0 && nextTier && (
                  <span className="flex items-center gap-1">
                    <TrendingUp className="size-3 text-primary" />
                    AUD {remaining.toLocaleString()} to{" "}
                    {nextTier.display_name}
                  </span>
                )}
              </div>

              {/* Quick stats row */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Monthly spend",
                    value: `AUD ${monthlySpend.toLocaleString()}`,
                  },
                  {
                    label: "Annual spend",
                    value: `AUD ${(rewards?.annual_spend ?? 0).toLocaleString()}`,
                  },
                  {
                    label: "Stamps earned",
                    value: `${rewards?.total_stamps ?? 0}`,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-border/50 bg-background/50 px-3 py-2.5 text-center"
                  >
                    <p className="text-lg font-bold text-foreground">
                      {s.value}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

// ============================================================
// Logged-out version — generic value prop
// ============================================================

function LoggedOutHero({
  tiers,
}: {
  tiers: Array<{ display_name: string; estimated_monthly_savings: number }>
}) {
  const topSavings = tiers.length > 0
    ? Math.max(...tiers.map((t) => t.estimated_monthly_savings))
    : 800

  return (
    <section className="relative overflow-hidden border-b border-border/60 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[800px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <FadeIn className="flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Gift className="size-4" />
            Loyalty &amp; Rewards
          </div>

          <BlurIn>
            <h1 className="text-4xl font-black tracking-[-0.025em] text-foreground sm:text-5xl lg:text-6xl">
              Buy more.{" "}
              <span className="text-primary">Save more.</span>
              <br />
              Get rewarded.
            </h1>
          </BlurIn>

          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Every litre earns rewards. No contracts, no points apps — just real
            products and real savings back in your hands.
            Save up to <span className="font-semibold text-foreground">AUD {topSavings.toLocaleString()}/mo</span> at the top tier.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-12 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-px hover:shadow-xl hover:shadow-primary/35"
              asChild
            >
              <Link href="/register">
                Join free — start saving
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
