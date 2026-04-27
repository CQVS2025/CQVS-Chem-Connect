import type { Metadata } from "next"
import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"

import { PageTransition } from "@/components/shared/page-transition"

// User-specific auth routes - defence in depth alongside the X-Robots-Tag
// header in next.config.mjs. Either alone is enough; both together stay
// safe if one config drifts out of sync with the other.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh">
      {/* Decorative left panel - hidden on mobile */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-[hsl(208_50%_15%)]" />

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(142_76%_56%/0.15)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,hsl(208_50%_15%/0.4)_0%,transparent_50%)]" />

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-between p-10">
          {/* Branding */}
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/images/cqvs-logo.png"
                alt="CQVS Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <span className="text-lg font-semibold tracking-tight text-white">
                  Chem Connect
                </span>
                <span className="block text-xs text-white/60">by CQVS</span>
              </div>
            </Link>
          </div>

          {/* Tagline */}
          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
              Your trusted B2B chemical marketplace
            </h1>
            <p className="text-base leading-relaxed text-white/70">
              Connect with verified suppliers, discover competitive pricing, and
              streamline your chemical procurement - all in one platform.
            </p>
          </div>

          {/* Bottom decorative quote */}
          <div className="max-w-sm">
            <blockquote className="space-y-2 border-l-2 border-white/20 pl-4">
              <p className="text-sm leading-relaxed text-white/60">
                &ldquo;Chem Connect transformed how we source raw materials.
                What used to take weeks now takes hours.&rdquo;
              </p>
              <footer className="text-xs text-white/40">
                - Procurement Lead, Fortune 500 Chemical Corp
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex w-full flex-1 flex-col items-center justify-center bg-background px-4 py-10 lg:w-1/2">
        {/* Mobile branding - shown only on small screens */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <Image
            src="/images/cqvs-logo.png"
            alt="CQVS Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <div>
            <span className="text-lg font-semibold tracking-tight">
              Chem Connect
            </span>
            <span className="block text-xs text-muted-foreground">by CQVS</span>
          </div>
        </div>

        <PageTransition className="w-full max-w-md">
          {children}
        </PageTransition>
      </div>
    </div>
  )
}
