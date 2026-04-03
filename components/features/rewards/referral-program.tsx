"use client"

import { useState } from "react"
import { Megaphone, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"
import { useUser } from "@/lib/hooks/use-auth"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const milestones = [
  {
    count: "1",
    label: "1 referral",
    reward: "Free 200L drum of Truck Wash Standard or Premium",
    condition: "Referred customer must place an order",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    count: "3",
    label: "3 referrals",
    reward: "Free freight for a full quarter",
    condition: "All 3 referred customers must place an order",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
  },
  {
    count: "5+",
    label: "5+ referrals",
    reward: "Ambassador - permanent 5% discount",
    condition: "All 5 referred customers must place an order",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
  },
]

export function ReferralProgram() {
  const { user, loading: authLoading } = useUser()
  const [form, setForm] = useState({
    referrerName: "",
    referredSiteName: "",
    contactPerson: "",
    referredEmail: "",
    phone: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!user) {
      setShowAuthDialog(true)
      return
    }

    if (
      !form.referrerName ||
      !form.referredSiteName ||
      !form.contactPerson ||
      !form.phone
    ) {
      toast.error("Please fill in all required fields")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/rewards/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed to submit")
      toast.success("Referral submitted! We'll reach out to them soon.")
      setForm({
        referrerName: "",
        referredSiteName: "",
        contactPerson: "",
        referredEmail: "",
        phone: "",
      })
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="referrals" className="scroll-mt-36 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10">
            <span className="mb-3 block text-sm font-bold tracking-widest text-primary">
              03
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Refer a Site, Get Rewarded
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Know someone overpaying for chemicals? Send them our way and earn
              free product.
            </p>
          </div>
        </FadeIn>

        {/* Milestone cards */}
        <StaggerContainer className="mb-10 grid gap-4 sm:grid-cols-3">
          {milestones.map((m) => (
            <StaggerItem key={m.count}>
              <Card className="border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-5 sm:p-6">
                  <div
                    className={cn(
                      "mb-3 flex size-12 items-center justify-center rounded-2xl text-2xl font-bold",
                      m.bgColor,
                      m.color
                    )}
                  >
                    {m.count}
                  </div>
                  <p className="mb-1 text-sm font-semibold text-foreground">
                    {m.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{m.reward}</p>
                  <p className="mt-1.5 text-[11px] italic text-muted-foreground/70">{m.condition}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <FadeIn delay={0.1}>
          <p className="mb-6 text-center text-xs font-medium text-muted-foreground">
            A &quot;successful referral&quot; = the referred customer places their
            first order. Rewards are issued automatically once the condition is met.
          </p>
        </FadeIn>

        {/* Referral form */}
        <FadeIn delay={0.2}>
          <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Megaphone className="size-5 text-primary" />
                </div>
                <h3 className="font-bold">TELL US WHO TO CALL</h3>
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="referrerName">Your name</Label>
                  <Input
                    id="referrerName"
                    placeholder="Your name"
                    required
                    value={form.referrerName}
                    onChange={(e) =>
                      setForm({ ...form, referrerName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referredSiteName">Referred site name</Label>
                  <Input
                    id="referredSiteName"
                    placeholder="Company / site name"
                    required
                    value={form.referredSiteName}
                    onChange={(e) =>
                      setForm({ ...form, referredSiteName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact person</Label>
                  <Input
                    id="contactPerson"
                    placeholder="Their name"
                    required
                    value={form.contactPerson}
                    onChange={(e) =>
                      setForm({ ...form, contactPerson: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referredEmail">Their email</Label>
                  <Input
                    id="referredEmail"
                    type="email"
                    placeholder="their@company.com"
                    value={form.referredEmail}
                    onChange={(e) =>
                      setForm({ ...form, referredEmail: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Optional - we&apos;ll send them an intro email about Chem Connect
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0400 000 000"
                    required
                    minLength={8}
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full shadow-md shadow-primary/25 transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/40 sm:w-auto"
                  >
                    <Send className="mr-2 size-4" />
                    {submitting ? "Submitting..." : "Submit Referral"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.3}>
          <p className="mt-6 rounded-xl border border-primary/10 bg-primary/5 px-5 py-4 text-sm leading-relaxed text-muted-foreground">
            Concrete and quarry is a small world. One conversation over a beer
            could earn you free product for a year.
          </p>
        </FadeIn>
      </div>

      <AuthPromptDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        title="Sign in to submit a referral"
        description="Create an account or sign in to refer a site and earn rewards."
      />
    </section>
  )
}
