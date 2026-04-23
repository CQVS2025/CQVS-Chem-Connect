/**
 * POST /api/marketing/conversations/[id]/read -- mark conversation as read
 */

import { NextResponse, type NextRequest } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { error } = await requireMarketingRole("view")
  if (error) return error
  const { id } = await params

  const supabase = createServiceRoleClient()
  const { error: dbError } = await supabase
    .from("sms_conversations")
    .update({ unread_count: 0 })
    .eq("id", id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
