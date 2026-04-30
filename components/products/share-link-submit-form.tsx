"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const NAME_FORMATS = [
  {
    value: "first_initial",
    label: "First name + last initial",
    example: "e.g. Marcus T.",
  },
  {
    value: "initials",
    label: "Initials only",
    example: "e.g. M. T.",
  },
  {
    value: "anonymous_city",
    label: "Anonymous from your city",
    example: "e.g. Anonymous from Brisbane",
  },
  {
    value: "role_state",
    label: "Role + state (no personal name)",
    example: "e.g. Plant Manager, NSW concrete plant",
  },
] as const

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"] as const

const HEADLINE_MIN = 4
const HEADLINE_MAX = 100
const BODY_MIN = 20
const BODY_MAX = 2000

interface Props {
  slug: string
  productName: string
  productSlug: string
}

function Required() {
  return (
    <span aria-hidden className="ml-1 text-destructive">
      *
    </span>
  )
}

export function ShareLinkSubmitForm({
  slug,
  productName,
  productSlug,
}: Props) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [nameFormat, setNameFormat] =
    useState<(typeof NAME_FORMATS)[number]["value"]>("first_initial")
  const [firstName, setFirstName] = useState("")
  const [lastInitial, setLastInitial] = useState("")
  const [role, setRole] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [email, setEmail] = useState("")
  const [companyOrRole, setCompanyOrRole] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const headlineLen = headline.trim().length
  const bodyLen = body.trim().length
  const headlineOk = headlineLen >= HEADLINE_MIN && headlineLen <= HEADLINE_MAX
  const bodyOk = bodyLen >= BODY_MIN && bodyLen <= BODY_MAX

  const selectedFormat = NAME_FORMATS.find((o) => o.value === nameFormat)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (rating === 0) return setError("Please pick a star rating before submitting.")
    if (headlineLen < HEADLINE_MIN)
      return setError(`Your headline is too short. Please write at least ${HEADLINE_MIN} characters.`)
    if (bodyLen < BODY_MIN)
      return setError(
        `Your review needs at least ${BODY_MIN} characters (you have ${bodyLen}). A few sentences is plenty.`,
      )
    if (nameFormat === "first_initial" || nameFormat === "initials") {
      if (!firstName.trim()) return setError("Please enter your first name.")
    }
    if (nameFormat === "anonymous_city" && !city.trim())
      return setError("Please enter your city for the anonymous-from-city format.")
    if (nameFormat === "role_state") {
      if (!role.trim()) return setError("Please enter your role or industry.")
      if (!state.trim()) return setError("Please pick your state.")
    }
    if (!email.trim()) return setError("Please enter your business email.")
    if (companyOrRole.trim().length < 2)
      return setError("Please enter your company name or role.")
    if (!consent)
      return setError("Please tick the consent box to confirm your review can be published publicly.")

    setSubmitting(true)
    try {
      const res = await fetch("/api/reviews/share/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          nameFormat,
          firstName: firstName.trim() || undefined,
          lastInitial: lastInitial.trim() || undefined,
          role: role.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          email: email.trim(),
          companyOrRole: companyOrRole.trim(),
          rating,
          headline: headline.trim(),
          body: body.trim(),
          consent: true,
          website,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Submission failed")
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-8 text-center dark:bg-emerald-950/30">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
        <h2 className="text-xl font-semibold tracking-tight">
          Thanks - your review is in.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The team will give it a quick check for our content policy and then
          publish it on the {productName} page. We&rsquo;ll never edit what you
          wrote.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/products/${productSlug}`}>Back to {productName}</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Honeypot - styled out of view but technically in the DOM. Bots that
          parse forms with regex auto-fill every input; real users never see
          this. Filled = silent reject server-side. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label htmlFor="website">
          Website (leave blank)
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {/* Rating */}
      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <Label className="mb-3 block text-sm font-medium">
          Your rating
          <Required />
        </Label>
        <div
          className="flex items-center gap-1"
          onMouseLeave={() => setHoverRating(0)}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const value = i + 1
            const lit = (hoverRating || rating) >= value
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} of 5 stars`}
                aria-pressed={rating === value}
                onMouseEnter={() => setHoverRating(value)}
                onClick={() => setRating(value)}
                className="rounded p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={
                    lit
                      ? "size-9 fill-amber-400 text-amber-400"
                      : "size-9 text-muted-foreground/30"
                  }
                />
              </button>
            )
          })}
          {rating > 0 ? (
            <span className="ml-3 text-sm font-medium">
              {rating} out of 5
            </span>
          ) : (
            <span className="ml-3 text-sm text-muted-foreground">
              Tap a star
            </span>
          )}
        </div>
      </section>

      {/* Headline */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="headline">
            Headline
            <Required />
          </Label>
          <span
            className={`text-xs ${headlineOk ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}
          >
            {headlineLen} / {HEADLINE_MAX}
            {headlineLen > 0 && headlineLen < HEADLINE_MIN
              ? ` · ${HEADLINE_MIN - headlineLen} more`
              : ""}
          </span>
        </div>
        <Input
          id="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="A one-line summary of your experience"
          maxLength={HEADLINE_MAX}
        />
      </section>

      {/* Body */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">
            Your review
            <Required />
          </Label>
          <span
            className={`text-xs ${bodyOk ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"}`}
          >
            {bodyLen} / {BODY_MAX}
            {bodyLen < BODY_MIN
              ? ` · ${BODY_MIN - bodyLen} more to reach minimum`
              : ""}
          </span>
        </div>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={BODY_MAX}
          placeholder="What worked? What didn't? Any context that would help other buyers - site type, application, dilution, anything."
        />
        <p className="text-xs text-muted-foreground">
          Two or three sentences is plenty. Don&rsquo;t include personal
          details (phone numbers, addresses, etc.).
        </p>
      </section>

      {/* Email + company/role - REQUIRED for share-link submissions to give
          moderation context that a magic-link review gets for free via the
          buyer's order record. */}
      <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="email">
            Your business email
            <Required />
          </Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourcompany.com.au"
          />
          <p className="text-xs text-muted-foreground">
            Used for moderation context only. Not displayed anywhere on the
            product page. Disposable email services aren&rsquo;t accepted.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyOrRole">
            Company or role
            <Required />
          </Label>
          <Input
            id="companyOrRole"
            value={companyOrRole}
            onChange={(e) => setCompanyOrRole(e.target.value)}
            placeholder="e.g. Acme Concreting / Workshop foreman"
          />
          <p className="text-xs text-muted-foreground">
            Helps the team verify the review is genuine. Not displayed on the
            product page (unless you choose the &ldquo;Role + state&rdquo;
            display option below, which is separate).
          </p>
        </div>
      </section>

      {/* Name format */}
      <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-6">
        <div>
          <Label className="mb-2 block text-sm font-medium">
            How should your name appear on the product page?
            <Required />
          </Label>
          <Select
            value={nameFormat}
            onValueChange={(v) => setNameFormat(v as typeof nameFormat)}
          >
            <SelectTrigger className="h-auto min-h-[58px] w-full py-2.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={6}
              className="w-[var(--radix-select-trigger-width)] min-w-[340px] max-w-[460px]"
            >
              {NAME_FORMATS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="py-3 pr-8"
                >
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-sm font-medium leading-tight">
                      {opt.label}
                    </span>
                    <span className="text-xs leading-tight text-muted-foreground">
                      {opt.example}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedFormat && (
            <p className="mt-2 text-xs text-muted-foreground">
              Will appear on the product page as something like{" "}
              <strong className="text-foreground">
                {selectedFormat.example.replace("e.g. ", "")}
              </strong>
              .
            </p>
          )}
        </div>

        {(nameFormat === "first_initial" || nameFormat === "initials") && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-normal text-muted-foreground">
                  First name
                  <Required />
                </Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Marcus"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastInitial" className="text-xs font-normal text-muted-foreground">
                  Last name initial <span className="text-muted-foreground/70">(optional)</span>
                </Label>
                <Input
                  id="lastInitial"
                  value={lastInitial}
                  onChange={(e) => setLastInitial(e.target.value)}
                  placeholder="T"
                  maxLength={1}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="city2" className="text-xs font-normal text-muted-foreground">
                  City <span className="text-muted-foreground/70">(optional)</span>
                </Label>
                <Input
                  id="city2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Brisbane"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-normal text-muted-foreground">
                  State <span className="text-muted-foreground/70">(optional)</span>
                </Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {AU_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {nameFormat === "anonymous_city" && (
          <div className="space-y-1.5">
            <Label htmlFor="city" className="text-xs font-normal text-muted-foreground">
              City
              <Required />
            </Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Brisbane"
            />
          </div>
        )}

        {nameFormat === "role_state" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="roleField" className="text-xs font-normal text-muted-foreground">
                Role or industry
                <Required />
              </Label>
              <Input
                id="roleField"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Plant Manager"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">
                State
                <Required />
              </Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a state" />
                </SelectTrigger>
                <SelectContent>
                  {AU_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      {/* Consent */}
      <section className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-5">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="consent"
          className="cursor-pointer text-sm font-normal leading-relaxed text-muted-foreground"
        >
          I confirm this is my honest opinion based on my use of the product.
          I understand it&rsquo;ll be displayed as a public reviewer (not a
          verified buyer) and won&rsquo;t count toward the product&rsquo;s
          star rating average.
          <Required />
        </Label>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Submitting&hellip;
            </>
          ) : (
            "Submit review"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Reviewing: <strong className="text-foreground">{productName}</strong>.
          You can&rsquo;t edit a review after submitting - if you spot a typo,
          contact us and we&rsquo;ll resolve it manually.
        </p>
      </div>
    </form>
  )
}
