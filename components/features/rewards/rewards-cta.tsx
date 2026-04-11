"use client"

import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/shared/motion"

export function RewardsCTA() {
  return (
    <section className="border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card px-6 py-16 text-center sm:px-12 sm:py-20">
            {/* Dot-grid background */}
            <div
              className="pointer-events-none absolute inset-0 text-foreground opacity-[0.04]"
              style={{
                backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            {/* Decorative halos */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/8 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-emerald-500/5" />

            <div className="relative">
              {/* Eyebrow pill */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                No contracts. No lock-in.
              </div>

              <h2 className="mb-4 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl md:text-5xl">
                Ready to Start Saving?
              </h2>
              <p className="mx-auto mb-10 max-w-lg text-base text-muted-foreground sm:text-lg">
                No minimum commitment. Just better
                chemicals at better prices with rewards that stack.
              </p>

              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-primary/40"
                  asChild
                >
                  <Link href="/products">
                    Place Your First Order
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl px-7 text-[15px] font-semibold"
                  asChild
                >
                  <Link href="/#how-it-works">
                    <MessageCircle className="mr-2 size-4" />
                    Talk to Our Team
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
