import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * POST /api/admin/reviews/manual
 *
 * Admin-only manual review entry. For reviews that arrive by phone, text,
 * or email during the seed phase. Tied to a real order_id and tagged with
 * source='manual' (Verified buyer, manually entered).
 *
 * Optional autoApprove flag flips the review straight to approved/published
 * in the same insert — useful for high-confidence transcribed reviews
 * from a known buyer where moderation is redundant.
 */

interface Body {
  productId?: unknown
  orderId?: unknown
  rating?: unknown
  headline?: unknown
  body?: unknown
  displayName?: unknown
  city?: unknown
  state?: unknown
  autoApprove?: unknown
}

function isStr(v: unknown): v is string {
  return typeof v === "string"
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  let payload: Body
  try {
    payload = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!isStr(payload.productId) || !isStr(payload.orderId)) {
    return NextResponse.json({ error: "Missing productId/orderId" }, { status: 400 })
  }
  const rating = Number(payload.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 })
  }
  if (!isStr(payload.headline) || payload.headline.trim().length < 4) {
    return NextResponse.json({ error: "Headline too short" }, { status: 400 })
  }
  if (!isStr(payload.body) || payload.body.trim().length < 20) {
    return NextResponse.json({ error: "Body too short" }, { status: 400 })
  }
  if (!isStr(payload.displayName) || payload.displayName.trim().length < 2) {
    return NextResponse.json({ error: "Display name required" }, { status: 400 })
  }

  const autoApprove = payload.autoApprove === true
  const service = createServiceRoleClient()

  const now = new Date().toISOString()
  const { data, error } = await service
    .from("reviews")
    .insert({
      product_id: payload.productId,
      order_id: payload.orderId,
      source: "manual",
      name_format: "first_initial", // not really meaningful for manual entry; display_name is the source of truth
      display_name: payload.displayName.trim(),
      reviewer_city: isStr(payload.city) ? payload.city.trim() || null : null,
      reviewer_state: isStr(payload.state) ? payload.state.trim() || null : null,
      rating,
      headline: payload.headline.trim(),
      body: payload.body.trim(),
      consent_given: true, // admin attests to consent at entry time
      status: autoApprove ? "approved" : "pending",
      moderated_at: autoApprove ? now : null,
      moderated_by: autoApprove ? auth.user.id : null,
      published_at: autoApprove ? now : null,
    })
    .select("id, product_id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    )
  }

  await service.from("review_audit_log").insert({
    review_id: data.id,
    product_id: data.product_id,
    action: "manually_entered",
    actor_id: auth.user.id,
    detail: { auto_approved: autoApprove, rating },
  })

  if (autoApprove) {
    await service.from("review_audit_log").insert({
      review_id: data.id,
      product_id: data.product_id,
      action: "approved",
      actor_id: auth.user.id,
      reason: "manual entry auto-approved",
    })
  }

  return NextResponse.json(
    { id: data.id, status: autoApprove ? "approved" : "pending" },
    { status: 201 },
  )
}
