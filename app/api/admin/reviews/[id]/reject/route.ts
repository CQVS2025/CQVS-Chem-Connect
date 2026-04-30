import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * POST /api/admin/reviews/[id]/reject
 *
 * Body: { reason: 'pii' | 'libel' | 'off_topic' | 'suspected_fake' | 'profanity' | 'other', notes?: string }
 *
 * 'other' requires a non-empty notes field. Audit-log entry is mandatory.
 */

const VALID_REASONS = [
  "pii",
  "libel",
  "off_topic",
  "suspected_fake",
  "profanity",
  "other",
] as const

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params

  let body: { reason?: unknown; notes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (
    typeof body.reason !== "string" ||
    !VALID_REASONS.includes(body.reason as (typeof VALID_REASONS)[number])
  ) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 })
  }
  const reason = body.reason as (typeof VALID_REASONS)[number]
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null

  if (reason === "other" && !notes) {
    return NextResponse.json(
      { error: "Notes required when reason is 'other'" },
      { status: 400 },
    )
  }

  const service = createServiceRoleClient()

  const { data, error } = await service
    .from("reviews")
    .update({
      status: "rejected",
      moderated_at: new Date().toISOString(),
      moderated_by: auth.user.id,
      rejection_reason: reason,
      rejection_notes: notes,
      published_at: null,
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
    action: "rejected",
    actor_id: auth.user.id,
    reason,
    detail: notes ? { notes } : null,
  })

  return NextResponse.json({ ok: true, id })
}
