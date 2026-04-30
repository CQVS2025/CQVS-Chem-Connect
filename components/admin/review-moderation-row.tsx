"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Loader2, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface ReviewProps {
  review: {
    id: string
    product_id: string
    rating: number
    headline: string
    body: string
    display_name: string
    reviewer_city: string | null
    reviewer_state: string | null
    source: "magic_link" | "manual" | "public_link"
    status: "pending" | "approved" | "rejected"
    rejection_reason: string | null
    submitted_at: string
    moderated_at: string | null
    products?: { name: string; slug: string } | null
    review_photos?: { id: string; public_url: string; position: number }[]
  }
}

const REJECTION_REASONS = [
  {
    value: "pii",
    label: "Personal info (PII)",
    helper: "Phone numbers, email addresses, full names of third parties, etc.",
  },
  {
    value: "libel",
    label: "Libel or defamatory",
    helper: "False statements that could damage someone's reputation.",
  },
  {
    value: "off_topic",
    label: "Off-topic",
    helper: "Not actually about the product (e.g. complaints about something else).",
  },
  {
    value: "suspected_fake",
    label: "Suspected fake / spam",
    helper: "Doesn't read like a genuine review (templated language, repetition, etc.).",
  },
  {
    value: "profanity",
    label: "Profanity",
    helper: "Swearing or slurs that breach our content policy.",
  },
  {
    value: "other",
    label: "Other (notes required)",
    helper: "Anything outside the categories above. The note is required for the audit log.",
  },
] as const

export function ReviewModerationRow({ review }: ReviewProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rejectReason, setRejectReason] =
    useState<(typeof REJECTION_REASONS)[number]["value"]>("off_topic")
  const [rejectNotes, setRejectNotes] = useState("")
  const [deleteReason, setDeleteReason] = useState(
    "Removal request from buyer",
  )

  const photos = (review.review_photos ?? []).sort(
    (a, b) => a.position - b.position,
  )
  const submitted = new Date(review.submitted_at).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  async function handleApprove() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}/approve`, {
        method: "POST",
      })
      if (!res.ok) throw new Error((await res.json()).error || "Approve failed")
      toast.success("Review approved.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (rejectReason === "other" && rejectNotes.trim().length < 4) {
      toast.error("Please provide a note when rejecting with reason 'Other'.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectReason,
          notes: rejectNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Reject failed")
      toast.success("Review rejected.")
      setRejectOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (deleteReason.trim().length < 4) {
      toast.error("Please provide a reason for the audit log.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed")
      toast.success("Review hard-deleted.")
      setDeleteOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={
                    i < review.rating
                      ? "size-4 fill-amber-400 text-amber-400"
                      : "size-4 text-muted-foreground/25"
                  }
                />
              ))}
            </div>
            <span className="text-sm font-medium">{review.rating}/5</span>
            {review.source === "manual" && (
              <Badge variant="secondary" className="text-[10px]">
                Manual
              </Badge>
            )}
            {review.source === "public_link" && (
              <Badge variant="outline" className="text-[10px]">
                Public link
              </Badge>
            )}
            {review.status === "rejected" && review.rejection_reason && (
              <Badge variant="destructive" className="text-[10px]">
                {review.rejection_reason}
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight">
            {review.headline}
          </h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {review.body}
          </p>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="mt-4 flex gap-2">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a
              key={p.id}
              href={p.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block size-24 overflow-hidden rounded-lg border border-border/60"
            >
              <img
                src={p.public_url}
                alt=""
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{review.display_name}</strong>
          {(review.reviewer_city || review.reviewer_state) && (
            <>
              {" · "}
              {[review.reviewer_city, review.reviewer_state]
                .filter(Boolean)
                .join(", ")}
            </>
          )}
        </span>
        {review.products?.slug && (
          <span>
            {" · "}
            <Link
              href={`/products/${review.products.slug}`}
              target="_blank"
              className="text-primary hover:underline"
            >
              {review.products.name}
            </Link>
          </span>
        )}
        <span className="ml-auto">{submitted}</span>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {review.status === "pending" && (
          <>
            <Button onClick={handleApprove} disabled={busy} size="sm">
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              Approve &amp; publish
            </Button>
            <Button
              onClick={() => setRejectOpen(true)}
              disabled={busy}
              variant="outline"
              size="sm"
            >
              <X className="mr-2 size-4" />
              Reject
            </Button>
            <span className="text-xs text-muted-foreground">
              Approve makes this review live on the product page. Reject keeps it in the audit log only.
            </span>
          </>
        )}
        {review.status === "approved" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Check className="size-3" />
            Live on product page
          </span>
        )}
        {review.status === "rejected" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <X className="size-3" />
            Not published
          </span>
        )}
        <Button
          onClick={() => setDeleteOpen(true)}
          disabled={busy}
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
          title="Permanently wipes the review, photos, and token. For removal requests from the buyer."
        >
          <Trash2 className="mr-2 size-4" />
          Permanent delete
        </Button>
      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this review</DialogTitle>
            <DialogDescription>
              Pick the policy reason that fits best. <strong>Low rating is
              not a valid rejection reason</strong> - we never hide
              negative reviews from the public. Every rejection is recorded
              in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Reason
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Select
                value={rejectReason}
                onValueChange={(v) => setRejectReason(v as typeof rejectReason)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Show the helper for the currently-selected reason. */}
              {(() => {
                const meta = REJECTION_REASONS.find((r) => r.value === rejectReason)
                return meta ? (
                  <p className="text-xs text-muted-foreground">{meta.helper}</p>
                ) : null
              })()}
            </div>
            <div className="space-y-1.5">
              <Label>
                Notes
                {rejectReason === "other" && (
                  <span className="ml-1 text-destructive">*</span>
                )}
                {rejectReason !== "other" && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                )}
              </Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
                placeholder={
                  rejectReason === "other"
                    ? "Required for ‘Other’ - describe the policy issue for the audit log."
                    : "Anything to add for the audit trail (which line was the problem, etc.)."
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={busy} variant="destructive">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Reject review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard-delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete this review?</DialogTitle>
            <DialogDescription>
              This <strong>cannot be undone</strong>. The review row, its
              token, and any uploaded photos will be wiped immediately.
              <br />
              <br />
              Use this only for <strong>data-removal requests</strong> from
              the buyer - not for normal moderation. For policy issues,
              use <em>Reject</em> instead so the row stays in the audit
              trail. The audit log keeps a record of the deletion (moderator,
              timestamp, reason) even after the review row is gone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>
              Reason for deletion
              <span className="ml-1 text-destructive">*</span>
            </Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={2}
              placeholder="e.g. Removal request from buyer (received via email, 28 Apr)"
            />
            <p className="text-xs text-muted-foreground">
              At least 4 characters. Recorded in the audit log alongside
              the deletion.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={busy} variant="destructive">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
