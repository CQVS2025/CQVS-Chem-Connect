"use client"

import { useState } from "react"
import { Sparkles, Bell, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"
import { useUser } from "@/lib/hooks/use-auth"
import { useFeatureFlags } from "@/lib/hooks/use-feature-flags"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const upcomingProducts = [
  {
    name: "AluBright",
    description:
      "Aluminium brightener - restores and protects aluminium surfaces",
    timing: "Coming 2026",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "border-sky-400/20",
  },
  {
    name: "BrakePrep",
    description:
      "Brake dust cleaner - fast-drying, residue-free formula",
    timing: "Coming 2026",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "border-violet-400/20",
  },
  {
    name: "Vision",
    description:
      "Commercial glass cleaner - streak-free, ammonia-free finish",
    timing: "Coming 2026",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    borderColor: "border-amber-400/20",
  },
]

const timeline = [
  "Teaser email",
  "Exclusive invite",
  "Launch day",
  "Feedback window",
]

export function NewProductLaunch() {
  const { user, loading: authLoading } = useUser()
  const { data: flags } = useFeatureFlags()
  const earlyAccessLimit = flags?.early_access_limit ?? 20
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Require login
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    if (!email) {
      toast.error("Please enter your email")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/rewards/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error("Failed to sign up")
      toast.success("You're on the list! We'll notify you at launch.")
      setEmail("")
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="new-products" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              07 - New Products
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              New Product Launch
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Be first. Get free product. First {earlyAccessLimit} customers get a
              free 200L drum with any order over AUD 1,000.
            </p>
          </div>
        </FadeIn>

        {/* Product cards */}
        <StaggerContainer className="mb-12 grid gap-4 sm:grid-cols-3">
          {upcomingProducts.map((product) => (
            <StaggerItem key={product.name}>
              <Card className={cn(
                "group h-full rounded-3xl border border-border/60 bg-card transition-all duration-300",
                "hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
              )}>
                <CardContent className="p-6 sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl border",
                        product.bgColor,
                        product.borderColor
                      )}
                    >
                      <Sparkles className={cn("size-5", product.color)} />
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {product.timing}
                    </Badge>
                  </div>

                  <h3 className="mb-2 text-lg font-bold tracking-[-0.01em] text-foreground">{product.name}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Timeline */}
        <FadeIn delay={0.1}>
          <div className="mb-12 flex items-center justify-center gap-0">
            {timeline.map((step, i) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                      i === 0
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        : "border border-border/60 bg-card text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </div>
                  <span className="mt-2 text-[11px] font-medium text-muted-foreground sm:text-xs">
                    {step}
                  </span>
                </div>
                {i < timeline.length - 1 && (
                  <div className="mx-1 mb-5 h-px w-8 bg-border/60 sm:mx-2 sm:w-16" />
                )}
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Signup form */}
        <FadeIn delay={0.2}>
          <Card className="rounded-3xl border border-border/60 bg-card">
            <CardContent className="p-6 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Bell className="size-5 text-primary" />
                </div>
                <h3 className="font-bold tracking-tight text-foreground">Join the Early Access List</h3>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Your email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting || authLoading}
                  className="h-12 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-primary/40"
                >
                  {submitting ? "Signing up..." : "Notify Me"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <AuthPromptDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        title="Sign in to join early access"
        description="Create an account or sign in to get notified when new products launch."
      />
    </section>
  )
}
