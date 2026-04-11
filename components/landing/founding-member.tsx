import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/shared/motion"

/**
 * "Founding member" callout - replaces the fake testimonial slot.
 * Be honest: we don't have customer quotes yet. Convert that into a
 * scarcity / early-access angle instead.
 */
export function FoundingMember() {
  return (
    <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/8 via-card to-card p-10 sm:p-14">
            {/* Decorative halo */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl"
            />

            <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Founding Member Pricing
                </span>

                <h2 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
                  Be one of our first{" "}
                  <span className="text-primary">50 plants</span>.
                </h2>
                <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                  We&apos;re onboarding the first 50 concrete plants and quarries
                  right now. Founding members get locked-in pricing 12 months
                  longer, plus direct line to our chief chemist.
                </p>

                <ul className="mt-6 grid gap-2.5 text-sm">
                  {[
                    "12-month price lock (vs standard 30 days)",
                    "Direct WhatsApp line to senior chemist",
                    "First access to new bulk-buy programs",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        ✓
                      </span>
                      <span className="text-muted-foreground">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                <div className="text-left lg:text-right">
                  <p className="font-mono text-sm text-muted-foreground">Spots remaining</p>
                  <p className="text-5xl font-black tracking-tight text-foreground">
                    37<span className="text-2xl text-muted-foreground">/50</span>
                  </p>
                </div>
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-px hover:shadow-xl hover:shadow-primary/35"
                  asChild
                >
                  <Link href="/register">
                    Claim your spot
                    <ArrowRight className="ml-2 h-4 w-4" />
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
