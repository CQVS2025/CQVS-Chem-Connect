"use client"

// Reset-password page. Handles two flows:
//
//   1. Supplier-invite flow (new):
//      URL has ?token_hash=…&type=recovery&email=…
//      We call supabase.auth.verifyOtp() on form SUBMIT (not on page
//      load) so email-link prefetchers can't burn the OTP.
//
//   2. Forgot-password / hash-based flow (legacy):
//      Supabase puts the session in the URL hash (#access_token=…).
//      The supabase client picks this up automatically on page load.
//      We just call updateUser() on submit.

import { Suspense, useEffect, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
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

function ResetPasswordContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hashError, setHashError] = useState<string | null>(null)

  const tokenHash = params.get("token_hash")
  const type = params.get("type") as "recovery" | "invite" | null

  // Surface any error the URL hash may carry from Supabase (e.g. when
  // the user clicks a stale link). Only relevant for the legacy flow -
  // the new token_hash flow doesn't put errors in the hash.
  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash) return
    const params = new URLSearchParams(hash.slice(1))
    const err = params.get("error_description")
    if (err) setHashError(err.replace(/\+/g, " "))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setHashError(null)

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirm-password") as string

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      setLoading(false)
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    const supabase = createClient()

    try {
      // Flow 1: token_hash from our supplier-invite email. Verify on
      // submit so email scanners can't burn the OTP before the human
      // clicks.
      if (tokenHash && type) {
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
        if (verifyErr) {
          toast.error(
            `Reset link is invalid or expired: ${verifyErr.message}. Ask your admin to resend the invite.`,
          )
          setLoading(false)
          return
        }
      }

      // Both flows: now we have a session - set the password.
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) {
        toast.error(
          `Unable to update password: ${updateErr.message}. The reset link may have expired - ask your admin to resend it.`,
        )
        return
      }

      toast.success("Password updated. Redirecting to sign-in…")
      // Sign out to ensure the next sign-in goes through the role-aware
      // redirect (suppliers → /supplier, admins → /admin, etc.)
      await supabase.auth.signOut().catch(() => {})
      router.push("/login")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      )
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
                  Set Your Password
                </CardTitle>
                <p className="text-xs text-muted-foreground">by CQVS</p>
              </div>
            </div>
            <CardDescription className="text-muted-foreground">
              {tokenHash
                ? "Enter the password you'd like to use for your supplier account."
                : "Enter your new password below."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0">
            {hashError && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {hashError}. Ask your admin to resend the invite - the new
                  link will use a one-time-only token that survives email-client
                  prefetching.
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    required
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
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
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {tokenHash ? "Set password & sign in" : "Update Password"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </m.div>
    </LazyMotion>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
