import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Star, X } from "lucide-react"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { buildShareUrl } from "@/lib/reviews/share-links"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ReviewModerationRow } from "@/components/admin/review-moderation-row"
import { GenerateShareLinkDialog } from "@/components/admin/generate-share-link-dialog"
import {
  ShareLinksTab,
  type ShareLinkRowData,
} from "@/components/admin/share-links-tab"

interface ReviewRow {
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

export const dynamic = "force-dynamic"
export const metadata = { title: "Reviews · Marketing · Chem Connect" }

async function loadReviews(
  status: "pending" | "approved" | "rejected",
  shareLinkId: string | null,
) {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from("reviews")
    .select(
      "id, product_id, rating, headline, body, display_name, reviewer_city, reviewer_state, source, status, rejection_reason, submitted_at, moderated_at, products(name, slug), review_photos(id, public_url, position)",
    )
    .eq("status", status)
  if (shareLinkId) {
    query = query.eq("share_link_id", shareLinkId)
  }
  const { data, error } = await query
    .order("submitted_at", { ascending: status === "pending" ? true : false })
    .limit(100)

  if (error) {
    console.error("Failed to load reviews:", error.message)
    return []
  }
  return (data ?? []) as unknown as ReviewRow[]
}

async function loadCounts(shareLinkId: string | null) {
  const supabase = createServiceRoleClient()
  const make = (status: "pending" | "approved" | "rejected") => {
    let q = supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", status)
    if (shareLinkId) q = q.eq("share_link_id", shareLinkId)
    return q
  }
  const [
    { count: pending },
    { count: approved },
    { count: rejected },
    { count: shareLinksActive },
  ] = await Promise.all([
    make("pending"),
    make("approved"),
    make("rejected"),
    supabase.from("review_share_links").select("id", { count: "exact", head: true }).eq("is_active", true),
  ])
  return {
    pending: pending ?? 0,
    approved: approved ?? 0,
    rejected: rejected ?? 0,
    shareLinksActive: shareLinksActive ?? 0,
  }
}

async function loadShareLinkContext(
  id: string | null,
): Promise<{ id: string; slug: string; productName: string } | null> {
  if (!id) return null
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("review_share_links")
    .select("id, slug, products(name)")
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  const row = data as { id: string; slug: string; products?: { name?: string } | null }
  return {
    id: row.id,
    slug: row.slug,
    productName: row.products?.name ?? "Unknown product",
  }
}

async function loadProducts(): Promise<
  { id: string; name: string; slug: string }[]
> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("products")
    .select("id, name, slug")
    .order("name")
    .limit(500)
  return (data ?? []) as { id: string; name: string; slug: string }[]
}

async function loadShareLinks(): Promise<ShareLinkRowData[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("review_share_links")
    .select(
      "id, slug, product_id, expires_at, max_uses, used_count, is_active, created_at, products(id, name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error || !data) return []

  return data.map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      slug: r.slug as string,
      share_url: buildShareUrl(r.slug as string),
      product_id: r.product_id as string,
      expires_at: (r.expires_at as string | null) ?? null,
      max_uses: (r.max_uses as number | null) ?? null,
      used_count: r.used_count as number,
      is_active: r.is_active as boolean,
      created_at: r.created_at as string,
      products: r.products as ShareLinkRowData["products"],
    }
  })
}

export default async function ReviewModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ share_link_id?: string }>
}) {
  const auth = await requireAdmin()
  if (auth.error) redirect("/login")

  const params = await searchParams
  const shareLinkId = params.share_link_id ?? null

  const [
    pending,
    approved,
    rejected,
    counts,
    products,
    shareLinks,
    shareLinkContext,
  ] = await Promise.all([
    loadReviews("pending", shareLinkId),
    loadReviews("approved", shareLinkId),
    loadReviews("rejected", shareLinkId),
    loadCounts(shareLinkId),
    loadProducts(),
    loadShareLinks(),
    loadShareLinkContext(shareLinkId),
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
        <div className="flex flex-wrap gap-2">
          <GenerateShareLinkDialog products={products} />
          <Button asChild>
            <Link href="/admin/marketing/reviews/new">
              <Plus className="mr-2 size-4" />
              Add review manually
            </Link>
          </Button>
        </div>
      </div>

      {shareLinkContext && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Filtering reviews by share link </span>
            <code className="rounded bg-card px-2 py-0.5 text-xs">
              ...{shareLinkContext.slug.slice(-6)}
            </code>
            <span className="text-muted-foreground"> for </span>
            <strong>{shareLinkContext.productName}</strong>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/marketing/reviews">
              <X className="mr-1 size-3.5" />
              Clear filter
            </Link>
          </Button>
        </div>
      )}

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
          <TabsTrigger value="share-links">
            Share links
            {counts.shareLinksActive > 0 && (
              <Badge variant="outline" className="ml-2">
                {counts.shareLinksActive}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing to moderate right now"
              message="When a buyer submits a review via the magic link in their post-delivery email - or via a public share link - it lands here for you to review. You can also add a review manually using the button above (e.g. for ones taken over the phone)."
            />
          ) : (
            pending.map((r) => <ReviewModerationRow key={r.id} review={r} />)
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4 space-y-3">
          {approved.length === 0 ? (
            <EmptyState
              title="No approved reviews yet"
              message="Approved reviews appear here and live on the product page. The first three approved verified-buyer reviews on a product unlock the AggregateRating star rich-result in Google search."
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

        <TabsContent value="share-links" className="mt-4">
          <ShareLinksTab links={shareLinks} />
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
