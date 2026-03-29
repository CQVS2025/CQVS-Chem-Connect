"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { useUser } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"

/**
 * Shows "Create Free Account" only when user is NOT logged in.
 * When logged in, shows "Go to Dashboard" instead.
 */
export function AuthCTA({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const { user, loading } = useUser()

  if (loading) return null

  if (user) {
    return (
      <Button size="lg" variant={variant} className="rounded-xl" asChild>
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    )
  }

  return (
    <Button size="lg" variant={variant} className="rounded-xl" asChild>
      <Link href="/register">Create Free Account</Link>
    </Button>
  )
}

/**
 * Full CTA button - "Create Your Free Account" with arrow, or "Go to Dashboard" if logged in.
 */
export function AuthCTAPrimary() {
  const { user, loading } = useUser()

  if (loading) return null

  if (user) {
    return (
      <Button
        size="lg"
        className="mt-8 rounded-xl shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:shadow-xl transition-shadow duration-200"
        asChild
      >
        <Link href="/dashboard">
          Go to Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    )
  }

  return (
    <Button
      size="lg"
      className="mt-8 rounded-xl shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:shadow-xl transition-shadow duration-200"
      asChild
    >
      <Link href="/register">
        Create Your Free Account
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  )
}
