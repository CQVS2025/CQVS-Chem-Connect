/**
 * GET /api/marketing/audit-log -- paginated audit entries, filterable by action.
 *
 * Query params:
 *   page   (1-indexed, default 1)
 *   limit  (per page, default 25, max 100)
 *   action (optional exact match on action string)
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(request: NextRequest) {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const sp = request.nextUrl.searchParams
  const action = sp.get("action")?.trim()
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 25), 1), 100)
  const page = Math.max(Number(sp.get("page") ?? 1), 1)
  const from = (page - 1) * limit
  const to = from + limit - 1

  const supabase = createServiceRoleClient()
  let query = supabase
    .from("marketing_audit_log")
    .select(
      "id, action, target_type, target_id, meta, occurred_at, actor_profile_id",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })
    .range(from, to)
  if (action) query = query.eq("action", action)

  const { data, error: dbError, count } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Two-step hydration so we don't depend on a named FK relationship.
  const rows = data ?? []
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_profile_id).filter(Boolean) as string[]),
  )
  const actorMap = new Map<string, { id: string; contact_name: string | null }>()
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, contact_name")
      .in("id", actorIds)
    for (const a of actors ?? []) {
      actorMap.set(a.id as string, {
        id: a.id as string,
        contact_name: (a.contact_name as string | null) ?? null,
      })
    }
  }

  const entries = rows.map((r) => ({
    id: r.id,
    action: r.action,
    target_type: r.target_type,
    target_id: r.target_id,
    meta: r.meta,
    occurred_at: r.occurred_at,
    actor: r.actor_profile_id
      ? (actorMap.get(r.actor_profile_id as string) ?? null)
      : null,
  }))

  return NextResponse.json({
    entries,
    total: count ?? 0,
    page,
    limit,
    totalPages: count ? Math.max(1, Math.ceil(count / limit)) : 1,
  })
}
