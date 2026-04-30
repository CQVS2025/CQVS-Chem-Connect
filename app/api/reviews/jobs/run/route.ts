/**
 * POST /api/reviews/jobs/run
 *
 * Daily cron endpoint. Picks up review_jobs rows where send_at <= now() and
 * status = 'pending', then dispatches each via runDueReviewJobs().
 *
 * Auth: shared secret in `x-cron-secret` header (env: MARKETING_CRON_SECRET).
 * Uses the same secret as the marketing-campaigns cron — one secret, one
 * auth surface across all the scheduled-job runners.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { runDueReviewJobs } from "@/lib/reviews/jobs"

export const maxDuration = 60

async function authorize(request: NextRequest): Promise<boolean> {
  const expected = process.env.MARKETING_CRON_SECRET
  if (!expected) return false
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return provided === expected
}

async function handle(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServiceRoleClient()
  const summary = await runDueReviewJobs(supabase)
  return NextResponse.json(summary)
}

export const GET = handle
export const POST = handle
