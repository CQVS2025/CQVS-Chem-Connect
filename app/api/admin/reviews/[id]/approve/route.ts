import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * POST /api/admin/reviews/[id]/approve
 *
 * Flips a pending review to status='approved' and stamps published_at.
 * Audit-log entry is mandatory.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  const service = createServiceRoleClient()

  const now = new Date().toISOString()
  const { data, error } = await service
    .from("reviews")
    .update({
      status: "approved",
      moderated_at: now,
      moderated_by: auth.user.id,
      published_at: now,
      rejection_reason: null,
      rejection_notes: null,
    })
    .eq("id", id)
    .select("id, product_id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Review not found" },
      { status: 404 },
    )
  }

  await service.from("review_audit_log").insert({
    review_id: id,
    product_id: data.product_id,
    action: "approved",
    actor_id: auth.user.id,
  })

  return NextResponse.json({ ok: true, id })
}
