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
    <section id="stamp-card" className="scroll-mt-36 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10">
            <span className="mb-3 block text-sm font-bold tracking-widest text-primary">
              08
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Physical Loyalty Stamp Card
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Old school. Still works. Every IBC order = 1 stamp. 10 stamps =
              free IBC of any product.
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Visual stamp card */}
          <FadeIn delay={0.1}>
            <Card className="overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-primary" />
                    <span className="text-sm font-bold tracking-wide">
                      CQVS
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
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
                          "flex aspect-square items-center justify-center rounded-xl border-2 text-sm font-bold transition-all duration-300",
                          isFilled
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-white/5 bg-muted/20 text-muted-foreground/40"
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
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-muted/20 px-4 py-3">
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
                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-center">
                    <p className="text-sm font-semibold text-primary">
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
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                    <Check className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}

              <div className="mt-6! rounded-xl border border-white/5 bg-muted/20 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Free IBC value
                </p>
                <p className="text-xl font-bold text-primary">
                  Up to $2,210
                </p>
              </div>
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={0.3}>
          <p className="mt-8 rounded-xl border border-primary/10 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            For the bloke running a batching plant who doesn&apos;t check apps -
            a card on the office wall with 6 stamps out of 10 is the most
            effective loyalty tool we can give you.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
