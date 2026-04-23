/**
 * GET /api/marketing/conversations -- thread list for inbox
 */

import { NextResponse } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET() {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const supabase = createServiceRoleClient()

  const { data, error: dbError } = await supabase
    .from("sms_conversations")
    .select(
      `id, unread_count, last_message_at, last_message_preview, last_message_direction,
       contact:marketing_contacts(id, full_name, first_name, last_name, phone, email, tags, is_opted_out)`,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ conversations: data ?? [] })
}
