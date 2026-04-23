/**
 * GET /api/marketing/contacts/[id]/sequences
 *
 * Returns this contact's sequence enrolment history from the audit log.
 * We rely on `sequence.enrolled` and `sequence.unenrolled` audit actions
 * where target_id = contact id.
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireMarketingRole("view")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { data, error: dbError } = await supabase
    .from("marketing_audit_log")
    .select("id, action, meta, occurred_at")
    .eq("target_type", "contact")
    .eq("target_id", id)
    .in("action", ["sequence.enrolled", "sequence.unenrolled"])
    .order("occurred_at", { ascending: false })
    .limit(100)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}
