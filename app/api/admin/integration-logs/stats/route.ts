import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/admin/integration-logs/stats
//
// Tiny dashboard summary so the admin landing has a single signal.
// Returns counts in the last 24h, broken down by integration / status /
// error_category. Cheap query — no aggregation pushdown needed at our
// volume.

export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("integration_log")
    .select("integration, status, error_category")
    .gte("created_at", since)
    .limit(10000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byIntegration: Record<string, { total: number; errors: number }> = {
    xero: { total: 0, errors: 0 },
    macship: { total: 0, errors: 0 },
  }
  const byCategory: Record<string, number> = {}

  for (const row of data ?? []) {
    const r = row as {
      integration: string
      status: string
      error_category: string | null
    }
    const bucket = byIntegration[r.integration] ?? { total: 0, errors: 0 }
    bucket.total += 1
    if (r.status === "error") bucket.errors += 1
    byIntegration[r.integration] = bucket
    if (r.error_category) {
      byCategory[r.error_category] = (byCategory[r.error_category] ?? 0) + 1
    }
  }

  return NextResponse.json({
    since,
    byIntegration,
    byCategory,
  })
}
