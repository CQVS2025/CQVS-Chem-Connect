"use client"

import { Stamp, CreditCard, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { FadeIn } from "@/components/shared/motion"
import { cn } from "@/lib/utils"

const features = [
  "Heavy card stock",
  "CQVS branded",
  "Driver stamps on delivery",
  "No app needed",
]

interface StampCardProps {
  stamps?: number
}

export function StampCard({ stamps = 0 }: StampCardProps) {
  const stampsPerCard = 10
  const currentCardStamps = stamps % stampsPerCard
  const freeIBCsEarned = Math.floor(stamps / stampsPerCard)
  const remaining = stampsPerCard - currentCardStamps
  const isLoggedIn = stamps > 0 || freeIBCsEarned > 0

  return (
    <section id="stamp-card" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              08 - Stamp Card
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Physical Loyalty Stamp Card
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Old school. Still works. Every 1000L IBC order = 1 stamp. 10
              stamps = free IBC of Truck Wash Standard, Truck Wash Premium,
              or Eco Wash.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Visual stamp card */}
          <FadeIn delay={0.1}>
            <Card className="overflow-hidden rounded-3xl border border-border/60 bg-card">
              <CardContent className="p-6 sm:p-7">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                      <CreditCard className="size-4 text-primary" />
                    </div>
                    <span className="text-sm font-bold tracking-wider text-foreground">
                      CQVS
                    </span>
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Loyalty Stamp Card
                  </span>
                </div>

                {/* Stamp grid */}
                <div className="mb-5 grid grid-cols-5 gap-2">
                  {Array.from({ length: stampsPerCard }).map((_, i) => {
                    const isFilled = i < currentCardStamps
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-2xl border-2 text-sm font-bold transition-all duration-300",
                          isFilled
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/20 text-muted-foreground/30"
                        )}
                      >
                        {isFilled ? (
                          <Stamp className="size-5 text-primary" />
                        ) : (
                          i + 1
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Progress */}
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <span className="text-2xl font-bold text-primary">
                      {currentCardStamps}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / {stampsPerCard} stamps
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {remaining > 0 && remaining < stampsPerCard
                      ? `${remaining} more to a free IBC`
                      : currentCardStamps === 0 && freeIBCsEarned > 0
                        ? "New card started!"
                        : `${remaining} more to a free IBC`}
                  </span>
                </div>

                {/* Free IBCs earned banner */}
                {freeIBCsEarned > 0 && (
                  <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                    <p className="text-sm font-bold text-primary">
                      {freeIBCsEarned} free IBC{freeIBCsEarned > 1 ? "s" : ""} earned!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stamps} total stamps collected
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Features */}
          <FadeIn delay={0.2}>
            <div className="flex h-full flex-col justify-center space-y-4">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <Check className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{feature}</span>
                </div>
              ))}

              <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 px-5 py-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Eligible free products
                </p>
                <p className="text-sm font-bold text-primary">
                  TW Standard, TW Premium, or Eco Wash IBC
                </p>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.3}>
          <p className="mt-8 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            For the bloke running a batching plant who doesn&apos;t check apps -
            a card on the office wall with 6 stamps out of 10 is the most
            effective loyalty tool we can give you.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
