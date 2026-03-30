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
    detail: "$5,200/mo - free IBC monthly",
    value: "$1,200/mo",
    color: "text-slate-300",
    bgColor: "bg-slate-300/10",
  },
  {
    emoji: "package",
    icon: Package,
    label: "Essentials Bundle",
    detail: "3 products - 10% off",
    value: "10% off",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    emoji: "dollar",
    icon: DollarSign,
    label: "Annual rebate",
    detail: "7.5% tier - $4,680 credit",
    value: "$4,680/yr",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
  },
  {
    emoji: "card",
    icon: CreditCard,
    label: "Stamp card",
    detail: "7 stamps - 3 to free IBC",
    value: "~$2,210",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
  },
  {
    emoji: "megaphone",
    icon: Megaphone,
    label: "Referrals",
    detail: "2 mates - 2 free drums",
    value: "~$700",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
]

export function StackRewards() {
  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <Infinity className="size-6 text-primary" />
            </div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Stack Your Rewards
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              All programs run simultaneously. Here&apos;s what a fully stacked
              CQVS customer looks like.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-5 sm:p-6">
              {/* Customer header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    Dave&apos;s Batching Plant
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground">
                    FULLY STACKED CUSTOMER EXAMPLE
                  </p>
                </div>
                <Badge className="border-0 bg-yellow-400/15 text-yellow-400">
                  Gold Potential
                </Badge>
              </div>

              {/* Reward items */}
              <StaggerContainer className="mb-6 space-y-3">
                {stackedRewards.map((reward) => {
                  const Icon = reward.icon
                  return (
                    <StaggerItem key={reward.label}>
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-xl border border-white/5 bg-muted/20 px-4 py-3 transition-all duration-200",
                          "hover:border-primary/10 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex size-9 items-center justify-center rounded-lg",
                              reward.bgColor
                            )}
                          >
                            <Icon
                              className={cn("size-4", reward.color)}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">
                              {reward.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {reward.detail}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary">
                          {reward.value}
                        </span>
                      </div>
                    </StaggerItem>
                  )
                })}
              </StaggerContainer>

              {/* Total */}
              <div className="rounded-xl border border-primary/20 bg-linear-to-r from-primary/5 to-emerald-500/5 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total estimated annual savings
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary sm:text-3xl">
                      $8,000-$12,000+
                    </p>
                    <p className="text-xs text-muted-foreground">/year</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="mt-6 rounded-xl border border-primary/10 bg-primary/5 px-5 py-4 text-center text-sm leading-relaxed italic text-muted-foreground">
            &quot;Every program makes switching more painful. Not because we
            lock you in - because we make staying worth it.&quot;
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
