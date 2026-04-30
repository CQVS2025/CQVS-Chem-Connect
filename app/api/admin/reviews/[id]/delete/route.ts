import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * POST /api/admin/reviews/[id]/delete
 *
 * Body: { reason: string }
 *
 * Permanent (hard) delete for buyer data-removal requests. Removes the
 * review row + photos (storage and DB) + the review_tokens row. The
 * audit_log entry (action='hard_deleted') survives because
 * review_audit_log.review_id is nullable.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params

  let body: { reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const reason =
    typeof body.reason === "string" && body.reason.trim().length >= 4
      ? body.reason.trim()
      : null
  if (!reason) {
    return NextResponse.json(
      { error: "Reason required (min 4 chars)" },
      { status: 400 },
    )
  }

  const service = createServiceRoleClient()

  // Load the review + photos so we can clean storage and audit-log accurately
  const { data: review, error: loadErr } = await service
    .from("reviews")
    .select("id, product_id, token_id, review_photos(id, storage_path)")
    .eq("id", id)
    .maybeSingle()

  if (loadErr || !review) {
    return NextResponse.json(
      { error: loadErr?.message ?? "Review not found" },
      { status: 404 },
    )
  }

  // Delete storage objects first (best-effort; logged but not fatal)
  const photos = (review as { review_photos?: { storage_path: string }[] }).review_photos ?? []
  if (photos.length > 0) {
    const paths = photos.map((p) => p.storage_path).filter(Boolean)
    const { error: storageErr } = await service.storage
      .from("review-photos")
      .remove(paths)
    if (storageErr) {
      console.error("review-photo storage cleanup failed:", storageErr.message)
    }
  }

  // Delete the token row (review_photos cascade off the reviews row)
  if ((review as { token_id?: string | null }).token_id) {
    await service
      .from("review_tokens")
      .delete()
      .eq("id", (review as { token_id: string }).token_id)
  }

  // Delete the review (review_photos cascade)
  const { error: delErr } = await service.from("reviews").delete().eq("id", id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // Audit log — review_id remains as a reference even though the row is gone.
  await service.from("review_audit_log").insert({
    review_id: id,
    product_id: (review as { product_id: string }).product_id,
    action: "hard_deleted",
    actor_id: auth.user.id,
    reason,
    detail: { photo_count: photos.length },
  })

  return NextResponse.json({ ok: true })
}
