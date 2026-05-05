"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

import { domAnimation, LazyMotion, m } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedState, setSelectedState] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = form.get("email") as string
    const password = form.get("password") as string
    const confirmPassword = form.get("confirm-password") as string

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

    // Pre-check: reject emails that already exist as a supplier or admin.
    // The user must use a different email for their customer account.
    try {
      const statusRes = await fetch("/api/auth/email-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (statusRes.ok) {
        const status = (await statusRes.json()) as {
          exists: boolean
          role: string | null
        }
        if (status.exists && status.role === "supplier") {
          toast.error(
            "This email is already registered as a supplier. Please use a different email to create a customer account.",
          )
          setLoading(false)
          return
        }
        if (status.exists && status.role === "admin") {
          toast.error(
            "This email is already registered as an admin. Please use a different email to create a customer account.",
          )
          setLoading(false)
          return
        }
      }
    } catch {
      // Pre-check is best-effort - if the lookup fails we still let
      // signUp proceed and rely on its own duplicate detection.
    }

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "customer" },
      },
    })

    if (error) {
      console.error("Signup error:", {
        message: error.message,
        status: error.status,
        code: error.code,
        name: error.name,
      })
      const msg = error.message?.toLowerCase() || ""
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("duplicate")) {
        toast.error("An account with this email already exists. Please sign in instead.")
      } else if (msg.includes("password")) {
        toast.error("Password does not meet requirements. Please use at least 6 characters.")
      } else {
        toast.error("Unable to create your account. Please try again or contact support.")
      }
      setLoading(false)
      return
    }

    // Update profile with company details directly via Supabase client
    // (the API route won't have the session cookie yet)
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          company_name: (form.get("company") as string) || null,
          abn: (form.get("abn") as string) || null,
          contact_name: (form.get("name") as string) || null,
          phone: (form.get("phone") as string) || null,
          address_street: (form.get("address") as string) || null,
          address_city: (form.get("city") as string) || null,
          address_state: selectedState || null,
          address_postcode: (form.get("postcode") as string) || null,
          delivery_address: (form.get("delivery-address") as string) || null,
          invoice_email:
            (form.get("invoice-email") as string) || (email as string),
          accepted_payment_terms_at: new Date().toISOString(),
        })
        .eq("id", data.user.id)

      if (profileError) {
        console.error("Profile update error:", profileError)
      }

      // Fire-and-forget Xero contact sync (non-blocking)
      fetch("/api/xero/contacts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: data.user.id }),
      }).catch(() => {
        // Silent fail - admin can resync later
      })

      // Upload logo if selected (now user is authenticated)
      if (logoFile) {
        try {
          const ext = logoFile.name.split(".").pop()
          const filePath = `logos/${data.user.id}.${ext}`

          await supabase.storage
            .from("company-logos")
            .upload(filePath, logoFile, {
              contentType: logoFile.type,
              upsert: true,
            })

          const { data: urlData } = supabase.storage
            .from("company-logos")
            .getPublicUrl(filePath)

          if (urlData?.publicUrl) {
            await supabase
              .from("profiles")
              .update({ company_logo_url: urlData.publicUrl })
              .eq("id", data.user.id)
          }
        } catch {
          // Non-blocking - user can upload in settings later
        }
      }
    }

    toast.success("Account created! Welcome to Chem Connect.")
    router.push("/dashboard")
    router.refresh()
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
        <div className="mb-2 flex items-center gap-3">
          <Image
            src="/images/cqvs-logo.png"
            alt="Chem Connect"
            width={48}
            height={48}
            className="rounded-lg"
          />
          <CardTitle className="text-2xl font-bold tracking-tight">
            Create your account
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              name="company"
              type="text"
              placeholder="Acme Chemicals Pty Ltd"
              autoComplete="organization"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="abn">ABN</Label>
            <Input
              id="abn"
              name="abn"
              type="text"
              placeholder="51 824 753 556"
              className="h-10"
            />
          </div>

          {/* Company Logo */}
          <div className="space-y-2">
            <Label>Company Logo <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <div className="flex items-center gap-3">
              <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/50 hover:bg-muted">
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground/50" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setLogoFile(file)
                      setLogoPreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </label>
              <div>
                <p className="text-sm text-muted-foreground">
                  {logoFile ? logoFile.name : "Click to upload. JPG, PNG, WebP, SVG. Max 2MB."}
                </p>
                {logoFile && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-destructive hover:underline"
                    onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Contact Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Smith"
              autoComplete="name"
              required
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              autoComplete="email"
              required
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Used to sign in to your account.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-email">
              Invoice Email{" "}
              <span className="text-xs text-muted-foreground">
                (where invoices should be sent)
              </span>
            </Label>
            <Input
              id="invoice-email"
              name="invoice-email"
              type="email"
              placeholder="accounts@company.com"
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use your login email. You can change this at
              checkout.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="04XX XXX XXX"
              autoComplete="tel"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Business Address</Label>
            <Input
              id="address"
              name="address"
              type="text"
              placeholder="123 Industrial Ave"
              autoComplete="street-address"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                type="text"
                placeholder="Sydney"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger id="state" className="h-10">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                name="postcode"
                type="text"
                placeholder="2000"
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-address">
              Delivery Location{" "}
              <span className="text-xs text-muted-foreground">
                (if different from business address)
              </span>
            </Label>
            <Input
              id="delivery-address"
              name="delivery-address"
              type="text"
              placeholder="456 Quarry Rd, Penrith NSW 2750"
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                autoComplete="new-password"
                required
                className="h-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                name="confirm-password"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
                className="h-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="terms"
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary"
            />
            <Label
              htmlFor="terms"
              className="text-sm font-normal leading-snug text-muted-foreground"
            >
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Privacy Policy
              </Link>
            </Label>
          </div>

          <div className="flex items-start gap-2.5">
            <input
              id="payment-terms"
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary"
            />
            <Label
              htmlFor="payment-terms"
              className="text-sm font-normal leading-snug text-muted-foreground"
            >
              I agree to{" "}
              <span className="font-medium text-foreground">
                30 days net payment terms
              </span>{" "}
              for purchase order invoices.
            </Label>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-10 text-sm glow-primary"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
    </m.div>
    </LazyMotion>
  )
}
