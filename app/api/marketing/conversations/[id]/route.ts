/**
 * GET /api/marketing/conversations/[id] -- messages in a thread
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

  const { data: conversation, error: cErr } = await supabase
    .from("sms_conversations")
    .select(
      `id, ghl_conversation_id, unread_count, last_message_at,
       contact:marketing_contacts(id, full_name, first_name, last_name, phone, email, ghl_contact_id, tags, is_opted_out)`,
    )
    .eq("id", id)
    .maybeSingle()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: messages } = await supabase
    .from("sms_messages")
    .select("id, direction, body, status, from_number, to_number, occurred_at")
    .eq("conversation_id", id)
    .order("occurred_at", { ascending: true })
    .limit(500)

  return NextResponse.json({ conversation, messages: messages ?? [] })
}
