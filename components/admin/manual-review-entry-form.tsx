"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock, Loader2, Star } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  products: { id: string; name: string; slug: string }[]
  orders: { id: string; order_number: string; user_id: string }[]
}

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
const HEADLINE_MIN = 4
const HEADLINE_MAX = 100
const BODY_MIN = 20
const BODY_MAX = 2000

function Required() {
  return (
    <span aria-hidden className="ml-1 text-destructive">
      *
    </span>
  )
}

export function ManualReviewEntryForm({ products, orders }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [productId, setProductId] = useState("")
  const [orderId, setOrderId] = useState("")
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [headline, setHeadline] = useState("")
  const [body, setBody] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [autoApprove, setAutoApprove] = useState(false)

  const headlineLen = headline.trim().length
  const bodyLen = body.trim().length
  const headlineOk = headlineLen >= HEADLINE_MIN && headlineLen <= HEADLINE_MAX
  const bodyOk = bodyLen >= BODY_MIN && bodyLen <= BODY_MAX

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) return toast.error("Pick a product.")
    if (!orderId) return toast.error("Pick a delivered order.")
    if (rating === 0) return toast.error("Click a star to set the rating.")
    if (headlineLen < HEADLINE_MIN)
      return toast.error(`Headline needs at least ${HEADLINE_MIN} characters.`)
    if (bodyLen < BODY_MIN)
      return toast.error(
        `Review body needs at least ${BODY_MIN} characters (you have ${bodyLen}).`,
      )
    if (!displayName.trim()) return toast.error("Display name is required.")

    setBusy(true)
    try {
      const res = await fetch("/api/admin/reviews/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          orderId,
          rating,
          headline: headline.trim(),
          body: body.trim(),
          displayName: displayName.trim(),
          city: city.trim() || null,
          state: state || null,
          autoApprove,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Submission failed")
      toast.success(
        autoApprove
          ? "Review approved and published."
          : "Review saved to the moderation queue.",
      )
      router.push("/admin/marketing/reviews")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product + order */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            Product
            <Required />
          </Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger aria-required>
              <SelectValue placeholder="Pick a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The review will be published on this product&rsquo;s page.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>
            Delivered order
            <Required />
          </Label>
          <Select value={orderId} onValueChange={setOrderId}>
            <SelectTrigger aria-required>
              <SelectValue placeholder="Pick a delivered order" />
            </SelectTrigger>
            <SelectContent>
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.order_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Only orders marked &ldquo;Delivered&rdquo; appear here. The reviewer
            must be a real buyer.
          </p>
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-1.5">
        <Label>
          Star rating
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
                onMouseEnter={() => setHoverRating(value)}
                onClick={() => setRating(value)}
                className="rounded p-1 transition-transform hover:scale-110"
                aria-label={`${value} of 5 stars`}
                aria-pressed={rating === value}
              >
                <Star
                  className={
                    lit
                      ? "size-7 fill-amber-400 text-amber-400"
                      : "size-7 text-muted-foreground/30"
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
              Click a star to rate
            </span>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-1.5">
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
          maxLength={HEADLINE_MAX}
          placeholder="One-line summary of the review"
        />
        <p className="text-xs text-muted-foreground">
          One-line summary the buyer would have written. {HEADLINE_MIN}&ndash;{HEADLINE_MAX} characters.
        </p>
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">
            Review text
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
          placeholder="Type the reviewer's words verbatim. Don't paraphrase or edit for tone."
        />
        <p className="text-xs text-muted-foreground">
          Minimum {BODY_MIN} characters. Type what the buyer actually said,
          word-for-word. Don&rsquo;t edit the review text.
        </p>
      </div>

      {/* Display + city + state */}
      <div className="space-y-1.5">
        <Label>How the reviewer should appear on the product page</Label>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-xs font-normal text-muted-foreground">
              Display name
              <Required />
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Marcus T."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city" className="text-xs font-normal text-muted-foreground">
              City <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Brisbane"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
              State <span className="text-muted-foreground/60">(optional)</span>
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
        <p className="text-xs text-muted-foreground">
          City and state add local-buyer trust signal. Skip them if you don&rsquo;t have permission to share.
        </p>
      </div>

      {/* Auto-approve toggle */}
      <div className="space-y-2">
        <Label>Publishing</Label>
        <label
          htmlFor="autoApprove"
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
            autoApprove
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-border/60 bg-muted/30 hover:bg-muted/50"
          }`}
        >
          <input
            type="checkbox"
            id="autoApprove"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              {autoApprove ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Approve and publish immediately
                </>
              ) : (
                <>
                  <Clock className="size-4 text-muted-foreground" />
                  Save to moderation queue (recommended)
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {autoApprove ? (
                <>
                  Review goes live on the product page <strong>right after save</strong>.
                  Use this only when you&rsquo;ve already vetted the wording (e.g.
                  the buyer dictated it on the phone).
                </>
              ) : (
                <>
                  Review is saved as <strong>Pending</strong>. It&rsquo;s
                  invisible to the public until you click <strong>Approve</strong>{" "}
                  on the moderation queue. Same flow as customer-submitted reviews.
                </>
              )}
            </p>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-border/60 pt-6">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving&hellip;
            </>
          ) : autoApprove ? (
            "Approve and publish"
          ) : (
            "Save to moderation queue"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/marketing/reviews")}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
