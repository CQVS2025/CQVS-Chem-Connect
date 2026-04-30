import Link from "next/link"
import { Plus, Star } from "lucide-react"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ReviewModerationRow } from "@/components/admin/review-moderation-row"

interface ReviewRow {
  id: string
  product_id: string
  rating: number
  headline: string
  body: string
  display_name: string
  reviewer_city: string | null
  reviewer_state: string | null
  source: "magic_link" | "manual"
  status: "pending" | "approved" | "rejected"
  rejection_reason: string | null
  submitted_at: string
  moderated_at: string | null
  products?: { name: string; slug: string } | null
  review_photos?: { id: string; public_url: string; position: number }[]
}

export const dynamic = "force-dynamic"
export const metadata = { title: "Reviews · Marketing · Chem Connect" }

async function loadReviews(status: "pending" | "approved" | "rejected") {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, product_id, rating, headline, body, display_name, reviewer_city, reviewer_state, source, status, rejection_reason, submitted_at, moderated_at, products(name, slug), review_photos(id, public_url, position)",
    )
    .eq("status", status)
    .order("submitted_at", { ascending: status === "pending" ? true : false })
    .limit(100)

  if (error) {
    console.error("Failed to load reviews:", error.message)
    return []
  }
  return (data ?? []) as unknown as ReviewRow[]
}

async function loadCounts() {
  const supabase = createServiceRoleClient()
  const [{ count: pending }, { count: approved }, { count: rejected }] =
    await Promise.all([
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    ])
  return {
    pending: pending ?? 0,
    approved: approved ?? 0,
    rejected: rejected ?? 0,
  }
}

export default async function ReviewModerationPage() {
  const auth = await requireAdmin()
  if (auth.error) redirect("/login")

  const [pending, approved, rejected, counts] = await Promise.all([
    loadReviews("pending"),
    loadReviews("approved"),
    loadReviews("rejected"),
    loadCounts(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">
            Customer reviews
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve reviews to publish them on the product page. Reject only
            for clear policy violations (personal info, libel, profanity,
            off-topic, suspected fakes) - <strong>never</strong> for low
            ratings. Every decision is recorded in the audit log.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/marketing/reviews/new">
            <Plus className="mr-2 size-4" />
            Add review manually
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {counts.pending > 0 && (
              <Badge variant="secondary" className="ml-2">
                {counts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved &amp; live
            <Badge variant="outline" className="ml-2">
              {counts.approved}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            <Badge variant="outline" className="ml-2">
              {counts.rejected}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing to moderate right now"
              message="When a buyer submits a review via the magic link in their post-delivery email, it lands here for you to review. You can also add a review manually using the button above (e.g. for ones taken over the phone)."
            />
          ) : (
            pending.map((r) => <ReviewModerationRow key={r.id} review={r} />)
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4 space-y-3">
          {approved.length === 0 ? (
            <EmptyState
              title="No approved reviews yet"
              message="Approved reviews appear here and live on the product page. The first three approved reviews on a product unlock the AggregateRating star rich-result in Google search."
            />
          ) : (
            approved.map((r) => <ReviewModerationRow key={r.id} review={r} />)
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4 space-y-3">
          {rejected.length === 0 ? (
            <EmptyState
              title="No rejected reviews"
              message="Rejected reviews stay in the database for audit purposes but are never displayed publicly. The rejection reason is recorded in the audit log."
            />
          ) : (
            rejected.map((r) => <ReviewModerationRow key={r.id} review={r} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-14 text-center">
      <div className="rounded-full bg-muted p-3">
        <Star className="size-5 text-muted-foreground/60" />
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
