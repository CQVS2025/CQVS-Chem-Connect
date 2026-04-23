/**
 * POST /api/marketing/conversations/[id]/send -- send an outbound SMS reply
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlConversations } from "@/lib/ghl"

interface RouteParams {
  params: Promise<{ id: string }>
}

const bodySchema = z.object({
  body: z.string().min(1).max(1600),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  const { data: convo } = await supabase
    .from("sms_conversations")
    .select(
      `id, ghl_conversation_id,
       contact:marketing_contacts(id, phone, ghl_contact_id, is_opted_out)`,
    )
    .eq("id", id)
    .maybeSingle()

  if (!convo || !convo.contact) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
  }

  const contact = Array.isArray(convo.contact) ? convo.contact[0] : convo.contact
  if (!contact.ghl_contact_id) {
    return NextResponse.json(
      { error: "Contact has no GHL id — cannot send" },
      { status: 400 },
    )
  }
  if (contact.is_opted_out) {
    return NextResponse.json(
      { error: "Contact is opted out; sends are blocked" },
      { status: 400 },
    )
  }

  // Optimistically insert queued row so the UI updates immediately via Realtime.
  const { data: optimistic } = await supabase
    .from("sms_messages")
    .insert({
      conversation_id: convo.id,
      direction: "outbound",
      body: parsed.data.body,
      status: "queued",
      sent_by: user?.id ?? null,
      to_number: contact.phone,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  try {
    const res = await GhlConversations.sendSmsMessage({
      contactId: contact.ghl_contact_id as string,
      message: parsed.data.body,
    })
    if (optimistic) {
      await supabase
        .from("sms_messages")
        .update({
          ghl_message_id: res.messageId,
          status: "sent",
        })
        .eq("id", optimistic.id)
    }
    // Bump conversation preview / timestamp
    await supabase
      .from("sms_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: parsed.data.body.slice(0, 160),
        last_message_direction: "outbound",
      })
      .eq("id", convo.id)

    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "sms.sent",
      target_type: "conversation",
      target_id: convo.id,
      meta: { message_id: res.messageId },
    })

    return NextResponse.json({ ok: true, messageId: res.messageId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (optimistic) {
      await supabase
        .from("sms_messages")
        .update({ status: "failed", error_message: message })
        .eq("id", optimistic.id)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
