"use client"

import { Suspense, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

import { domAnimation, LazyMotion, m } from "framer-motion"
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dashboard"
  const isSuspended = searchParams.get("suspended") === "true"
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const email = formData.get("email") as string
      const password = formData.get("password") as string

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

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        const msg = error.message.toLowerCase()
        const isBanned = msg.includes("banned") || msg.includes("suspended")

        if (isBanned) {
          toast.error("Account suspended", {
            description:
              "Your account has been suspended. Please contact support for assistance.",
            duration: 15000,
          })
        } else {
          toast.error("Incorrect password. Please try again.", {
            description: "Use the 'Forgot password?' link if you need to reset it.",
          })
        }
        return
      }

      // Check user role to determine redirect
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let destination = redirectTo
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        const isAdmin = profile?.role === "admin"
        if (redirectTo === "/dashboard" && isAdmin) {
          destination = "/admin"
        } else if (!redirectTo || redirectTo === "/dashboard") {
          destination = isAdmin ? "/admin" : "/dashboard"
        }
      }

      toast.success("Signed in successfully")
      router.push(destination)
      router.refresh()
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
    <Card className="border-0 shadow-none ring-0 bg-transparent">
      <CardHeader className="space-y-1 px-0">
        <m.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mb-2 flex items-center gap-3"
        >
          <Image
            src="/images/cqvs-logo.png"
            alt="Chem Connect"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Chem Connect
            </CardTitle>
            <p className="text-xs text-muted-foreground">by CQVS</p>
          </div>
        </m.div>
        <CardDescription className="text-muted-foreground">
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        {isSuspended && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            Your account has been suspended. Please contact support if you
            believe this is a mistake.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              required
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="h-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
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

          <div className="flex items-center gap-2.5">
            <input
              id="remember"
              type="checkbox"
              className="h-4 w-4 shrink-0 rounded border border-input accent-primary"
            />
            <Label
              htmlFor="remember"
              className="text-sm font-normal text-muted-foreground"
            >
              Remember me
            </Label>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-10 text-sm glow-primary"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
    </m.div>
    </LazyMotion>
  )
}
