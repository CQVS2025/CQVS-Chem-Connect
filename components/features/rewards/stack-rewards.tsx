"use client"

import {
  Crown,
  Package,
  DollarSign,
  CreditCard,
  Megaphone,
  Infinity,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { cn } from "@/lib/utils"

const stackedRewards = [
  {
    emoji: "crown",
    icon: Crown,
    label: "Silver tier",
    detail: "AUD 5,200/mo — free IBC monthly",
    value: "AUD 1,200/mo",
    color: "text-slate-300",
    bgColor: "bg-slate-300/10",
    borderColor: "border-slate-300/20",
  },
  {
    emoji: "package",
    icon: Package,
    label: "Essentials Bundle",
    detail: "3 products — 10% off",
    value: "10% off",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  {
    emoji: "dollar",
    icon: DollarSign,
    label: "Annual rebate",
    detail: "7.5% tier — AUD 4,680 credit",
    value: "AUD 4,680/yr",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    borderColor: "border-yellow-400/20",
  },
  {
    emoji: "card",
    icon: CreditCard,
    label: "Stamp card",
    detail: "7 stamps — 3 to free IBC",
    value: "~AUD 2,210",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "border-violet-400/20",
  },
  {
    emoji: "megaphone",
    icon: Megaphone,
    label: "Referrals",
    detail: "2 mates — 2 free drums",
    value: "~AUD 700",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
  },
]

export function StackRewards() {
  return (
    <section className="border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Infinity className="size-3.5" />
              Stack Your Rewards
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Stack Your Rewards
            </h2>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
              All programs run simultaneously. Here&apos;s what a fully stacked
              CQVS customer looks like.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card">
            <CardContent className="p-6 sm:p-8">
              {/* Customer header */}
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-[-0.01em] text-foreground">
                    Dave&apos;s Batching Plant
                  </h3>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Fully Stacked Customer Example
                  </p>
                </div>
                <Badge className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-yellow-400">
                  Gold Potential
                </Badge>
              </div>

              {/* Reward items */}
              <StaggerContainer className="mb-7 space-y-2.5">
                {stackedRewards.map((reward) => {
                  const Icon = reward.icon
                  return (
                    <StaggerItem key={reward.label}>
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3.5 transition-all duration-200",
                          "hover:border-primary/20 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                              reward.bgColor,
                              reward.borderColor
                            )}
                          >
                            <Icon
                              className={cn("size-4", reward.color)}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {reward.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {reward.detail}
                            </p>
                          </div>
                        </div>
                        <span className="ml-4 shrink-0 text-sm font-bold text-primary">
                          {reward.value}
                        </span>
                      </div>
                    </StaggerItem>
                  )
                })}
              </StaggerContainer>

              {/* Total */}
              <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 to-emerald-500/5 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Total estimated annual savings
                    </p>
                    <p className="text-xs text-muted-foreground">All programs combined</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tracking-[-0.02em] text-primary sm:text-3xl">
                      AUD 8,000-12,000+
                    </p>
                    <p className="text-xs text-muted-foreground">/year</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-center text-sm leading-relaxed italic text-muted-foreground">
            &quot;Every program makes switching more painful. Not because we
            lock you in — because we make staying worth it.&quot;
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
