"use client"

import { useState } from "react"
import Link from "next/link"
import { Camera, CheckCircle2, Loader2, Star, X } from "lucide-react"

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

interface UploadedPhoto {
  storagePath: string
  publicUrl: string
}

interface Props {
  token: string
  productName: string
  productSlug: string
  productImageUrl: string | null
}

function Required() {
  return (
    <span aria-hidden className="ml-1 text-destructive">
      *
    </span>
  )
}

export function ReviewSubmitForm({
  token,
  productName,
  productSlug,
}: Props) {
  const [rating, setRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [nameFormat, setNameFormat] =
    useState<(typeof NAME_FORMATS)[number]["value"]>("first_initial")
  const [firstName, setFirstName] = useState("")
  const [lastInitial, setLastInitial] = useState("")
  const [role, setRole] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [consent, setConsent] = useState(false)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const headlineLen = headline.trim().length
  const bodyLen = body.trim().length
  const headlineOk = headlineLen >= HEADLINE_MIN && headlineLen <= HEADLINE_MAX
  const bodyOk = bodyLen >= BODY_MIN && bodyLen <= BODY_MAX

  const selectedFormat = NAME_FORMATS.find((o) => o.value === nameFormat)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || photos.length >= 3) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photos must be JPEG, PNG, or WebP. Other formats aren't accepted.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Photos need to be 5 MB or smaller - try a smaller version.`,
      )
      return
    }
    setError(null)
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append("token", token)
      fd.append("file", file)
      const res = await fetch("/api/reviews/upload", {
        method: "POST",
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload failed")
      setPhotos((p) => [
        ...p,
        { storagePath: json.storagePath, publicUrl: json.publicUrl },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(index: number) {
    setPhotos((p) => p.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (rating === 0) {
      setError("Please pick a star rating before submitting.")
      return
    }
    if (headlineLen < HEADLINE_MIN) {
      setError(
        `Your headline is too short. Please write at least ${HEADLINE_MIN} characters.`,
      )
      return
    }
    if (bodyLen < BODY_MIN) {
      setError(
        `Your review needs at least ${BODY_MIN} characters (you have ${bodyLen}). A few sentences is plenty.`,
      )
      return
    }
    // Name-format-specific required fields
    if (nameFormat === "first_initial" || nameFormat === "initials") {
      if (!firstName.trim()) {
        setError("Please enter your first name.")
        return
      }
    }
    if (nameFormat === "anonymous_city" && !city.trim()) {
      setError("Please enter your city for the anonymous-from-city format.")
      return
    }
    if (nameFormat === "role_state") {
      if (!role.trim()) {
        setError("Please enter your role or industry.")
        return
      }
      if (!state.trim()) {
        setError("Please pick your state.")
        return
      }
    }
    if (!consent) {
      setError(
        "Please tick the consent box to confirm your review can be published publicly.",
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          nameFormat,
          firstName: firstName.trim() || undefined,
          lastInitial: lastInitial.trim() || undefined,
          role: role.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          rating,
          headline: headline.trim(),
          body: body.trim(),
          consent: true,
          photos,
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
          We&rsquo;ll review it for our content policy (no personal info, no
          libel, no off-topic content) and publish it on the {productName}{" "}
          page within 24 hours. We&rsquo;ll never edit what you wrote.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/products/${productSlug}`}>Back to {productName}</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
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
        <p className="mt-3 text-xs text-muted-foreground">
          Honest is better than nice. Negative or mixed reviews carry the most
          weight with other buyers - we never hide them.
        </p>
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
        <p className="text-xs text-muted-foreground">
          The headline appears at the top of the review card. {HEADLINE_MIN}&ndash;{HEADLINE_MAX} characters.
        </p>
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
          placeholder="What worked? What didn't? Any context that would help other buyers - site type, application, dilution, freight, anything."
        />
        <p className="text-xs text-muted-foreground">
          Two or three sentences is plenty. Minimum {BODY_MIN} characters.
          Don&rsquo;t include personal details (phone numbers, addresses, etc.).
        </p>
      </section>

      {/* Photos */}
      <section className="space-y-3">
        <div>
          <Label>Photos <span className="text-muted-foreground/70">(optional)</span></Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to 3. JPEG, PNG, or WebP. Max 5 MB each. Avoid faces, plates,
            or anything you wouldn&rsquo;t want public.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((p, idx) => (
            <div
              key={p.storagePath}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.publicUrl}
                alt={`Photo ${idx + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/60 bg-muted/40 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-muted">
              {uploading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>Uploading&hellip;</span>
                </>
              ) : (
                <>
                  <Camera className="size-5" />
                  <span>Add photo</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {3 - photos.length} left
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
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
            {/* Trigger is taller (h-auto + py-2.5) so the two-line label + example
                fits without clipping. w-full so it spans the section. */}
            <SelectTrigger className="h-auto min-h-[58px] w-full py-2.5">
              <SelectValue />
            </SelectTrigger>
            {/* Dropdown menu is wider than the default (which is just the trigger
                width) so the longer "Reviewer at {role}, {state}" example doesn't
                wrap awkwardly. */}
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
                  City <span className="text-muted-foreground/70">(optional, shown next to your name)</span>
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
            <p className="text-xs text-muted-foreground">
              Just your city - no first name, no last name. Adds a small
              local-buyer signal without identifying you.
            </p>
          </div>
        )}

        {nameFormat === "role_state" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-xs font-normal text-muted-foreground">
                Role or industry
                <Required />
              </Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Plant Manager"
              />
              <p className="text-xs text-muted-foreground">
                E.g. &ldquo;Plant Manager&rdquo;, &ldquo;Workshop Foreman&rdquo;,
                &ldquo;Procurement Lead&rdquo;.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">
                State
                <Required />
              </Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state">
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
          I understand my review will be displayed publicly on the Chem Connect
          product page - including the name format I&rsquo;ve selected,
          my city/state if I provided them, the date, and any photos I&rsquo;ve
          attached. I confirm the content is mine and not a paid placement.
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
          You can&rsquo;t edit a review after submitting - if you spot a
          typo, contact us and we&rsquo;ll re-issue the link.
        </p>
      </div>
    </form>
  )
}
