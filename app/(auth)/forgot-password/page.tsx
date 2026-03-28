"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { domAnimation, LazyMotion, m } from "framer-motion"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      // Check if account exists
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("email", email)

      if (count === 0) {
        toast.error("No account found with this email.", {
          description: "Please check the email address or create a new account.",
        })
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        toast.error("Unable to send reset link. Please try again.")
        return
      }

      setSent(true)
      toast.success("Reset link sent! Check your email.")
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <CardHeader className="space-y-1 px-0">
            <div className="mb-2 flex items-center gap-3">
              <Image
                src="/images/cqvs-logo.png"
                alt="Chem Connect"
                width={48}
                height={48}
                className="rounded-lg"
              />
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Reset Password
                </CardTitle>
                <p className="text-xs text-muted-foreground">by CQVS</p>
              </div>
            </div>
            <CardDescription className="text-muted-foreground">
              {sent
                ? "Check your email for the reset link."
                : "Enter your email and we will send you a password reset link."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0">
            {sent ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Check your inbox</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We sent a password reset link to{" "}
                    <span className="font-medium text-foreground">{email}</span>.
                    Click the link in the email to reset your password.
                  </p>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Didn&apos;t receive the email?{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setSent(false)}
                  >
                    Try again
                  </button>
                </p>

                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    required
                    className="h-10"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-10 w-full text-sm glow-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </m.div>
    </LazyMotion>
  )
}
