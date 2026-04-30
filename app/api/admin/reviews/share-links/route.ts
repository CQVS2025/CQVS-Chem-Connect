import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { buildShareUrl, generateSlug } from "@/lib/reviews/share-links"

/**
 * GET  /api/admin/reviews/share-links
 *   Returns the most recent share links across all products with usage
 *   counts and product info attached.
 *
 * POST /api/admin/reviews/share-links
 *   Body: { productId, expiresInDays?: number | null, maxUses?: number | null }
 *   Creates a new share link, returns its slug + full URL.
 */

const VALID_EXPIRY_DAYS = new Set([7, 30, 90])

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const service = createServiceRoleClient()
  const { data, error } = await service
    .from("review_share_links")
    .select(
      "id, slug, product_id, expires_at, max_uses, used_count, is_active, created_at, products(id, name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Add the full URL for convenience.
  const enriched = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    share_url: buildShareUrl(row.slug as string),
  }))

  return NextResponse.json({ links: enriched })
}

interface CreateBody {
  productId?: unknown
  expiresInDays?: unknown
  maxUses?: unknown
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (typeof body.productId !== "string" || !body.productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 })
  }

  // expiresInDays: accept null (no expiry), or one of 7/30/90.
  let expiresAt: string | null = null
  if (body.expiresInDays !== null && body.expiresInDays !== undefined) {
    const days = Number(body.expiresInDays)
    if (!VALID_EXPIRY_DAYS.has(days)) {
      return NextResponse.json(
        { error: "expiresInDays must be 7, 30, 90, or null" },
        { status: 400 },
      )
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }

  // maxUses: accept null (unlimited) or a positive integer up to 10_000.
  let maxUses: number | null = null
  if (body.maxUses !== null && body.maxUses !== undefined && body.maxUses !== "") {
    const n = Number(body.maxUses)
    if (!Number.isInteger(n) || n < 1 || n > 10_000) {
      return NextResponse.json(
        { error: "maxUses must be a positive integer up to 10,000, or blank for unlimited" },
        { status: 400 },
      )
    }
    maxUses = n
  }

  const service = createServiceRoleClient()

  // Verify the product exists.
  const { data: product, error: prodErr } = await service
    .from("products")
    .select("id, name, slug")
    .eq("id", body.productId)
    .maybeSingle()
  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  // Generate a unique slug. Retry on collision (vanishingly rare with 31^9
  // entropy, but the unique index will stop us writing a duplicate).
  let slug = generateSlug()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await service
      .from("review_share_links")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (!existing) break
    slug = generateSlug()
    attempts++
  }

  const { data: inserted, error: insertErr } = await service
    .from("review_share_links")
    .insert({
      slug,
      product_id: body.productId,
      created_by: auth.user.id,
      expires_at: expiresAt,
      max_uses: maxUses,
    })
    .select("id, slug, product_id, expires_at, max_uses, used_count, is_active, created_at")
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create share link" },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      link: { ...inserted, share_url: buildShareUrl(slug), product },
    },
    { status: 201 },
  )
}
