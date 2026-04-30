import { NextRequest, NextResponse } from "next/server"

import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * POST /api/admin/reviews/share-links/[id]/revoke
 *
 * Sets is_active = false on the share link. The link stops working
 * immediately - the page-load and submit-time checks both gate on
 * is_active, and the admin list view filters by it for the active set.
 *
 * Doesn't delete - revoked links stay in the table so the audit trail
 * (who created it, who used it, when) survives.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const { id } = await params
  const service = createServiceRoleClient()

  const { data, error } = await service
    .from("review_share_links")
    .update({ is_active: false })
    .eq("id", id)
    .select("id")
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Share link not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, id })
}
