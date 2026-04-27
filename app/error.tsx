"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Home, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Global error boundary - replaces Next.js's default 500 with something
 * the visitor can act on instead of stare at. Must be a Client Component
 * because it owns the `reset()` callback Next provides.
 *
 * Logs the error digest to console for debugging in production (the
 * digest is a hash Next gives us; the actual error stack is hidden from
 * the user but available in server logs by digest).
 */
export default function GlobalErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Surface the digest so it's grep-able in browser logs / Sentry-equivalent.
    console.error("[error.tsx] Application error:", error.digest, error.message)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
        500 &middot; Something went wrong
      </p>
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
        Sorry - that didn&rsquo;t work.
      </h1>
      <p className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground">
        Something on our side broke loading this page. The team has been
        notified. You can try again, head back to the catalogue, or get in
        touch with support if it keeps happening.
      </p>

      {error.digest && (
        <p className="mt-6 inline-block rounded-md border border-border/60 bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <Home className="mr-2 size-4" />
            Back to home
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <a href="mailto:support@chemconnect.com.au">Email support</a>
        </Button>
      </div>
    </main>
  )
}
