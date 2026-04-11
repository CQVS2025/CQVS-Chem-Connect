"use client"

import Link from "next/link"
import { ArrowRight, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useUser } from "@/lib/hooks/use-auth"
import { FadeIn } from "@/components/shared/motion"

export function FinalCta() {
  const { user, loading } = useUser()

  return (
    <section className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      {/* Background — slowly rotating radial gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="absolute h-[800px] w-[800px] animate-[spin_60s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,hsl(142_76%_56%/0.12),transparent_25%,transparent_50%,hsl(142_76%_56%/0.08)_75%,transparent)] motion-reduce:animate-none" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/0 via-background/50 to-background"
      />

      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <FadeIn>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Ready when you are
          </span>

          <h2 className="mt-6 text-[clamp(2.25rem,5vw,4rem)] font-black leading-[1] tracking-[-0.035em] text-foreground">
            Stop chasing quotes.
            <br />
            <span className="text-primary">Start saving.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Free to join. No card required. See live manufacturer-direct
            pricing in under a minute.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="h-12 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-px hover:shadow-xl hover:shadow-primary/35"
              asChild
            >
              <Link href="/products">
                Browse Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            {!loading && !user && (
              <Button
                variant="outline"
                size="lg"
                className="h-12 rounded-xl border-border bg-card/40 px-7 text-[15px] font-semibold backdrop-blur-sm hover:bg-secondary/50"
                asChild
              >
                <Link href="/register">Create Free Account</Link>
              </Button>
            )}

            {/* <Button
              variant="ghost"
              size="lg"
              className="h-12 rounded-xl px-5 text-[15px] font-semibold text-muted-foreground hover:text-foreground"
              asChild
            >
              <a href="tel:+611300000000">
                <Phone className="mr-2 h-4 w-4" />
                Talk to a specialist
              </a>
            </Button> */}
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            No setup fees · No minimum order · Cancel anytime
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
