/**
 * GoHighLevel conversations / inbound SMS webhook.
 *
 * GHL fires this for:
 *   - InboundMessage (customer replies)
 *   - OutboundMessage (we sent — for mirror consistency)
 *   - MessageStatus   (delivered/failed updates)
 *
 * Workflow-based webhooks send a custom header `x-ghl-signature` with the
 * shared secret (same scheme as contacts + events routes).
 */

import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  getSignatureHeader,
  verifyGhlSignature,
} from "@/lib/ghl/webhooks"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"
import { normaliseAuPhone } from "@/lib/ghl/phone"
import { logWebhook } from "@/lib/ghl/webhook-log"

interface MessageWebhookPayload {
  type?: string
  eventType?: string
  locationId?: string
  conversationId?: string
  contactId?: string
  messageId?: string
  direction?: "inbound" | "outbound"
  messageType?: string    // "SMS" / "Email" / ...
  body?: string
  from?: string
  to?: string
  status?: string
  dateAdded?: string
  timestamp?: string
}

/**
 * SMS opt-out detection.
 *
 * AU convention: a single opt-out keyword sent as the whole message body
 * (with optional punctuation/whitespace). Matching "cancel" or "end"
 * as plain words inside a longer message caused false positives — a user
 * saying "please cancel my order" should NOT be opted out.
 *
 * So we require the body to be JUST the keyword (case-insensitive), with
 * only whitespace/punctuation around it.
 */
const STOP_RE = /^\s*(stop|unsubscribe|opt\s*out|stopall|end\s*all)[.!?]?\s*$/i

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = getSignatureHeader(request)

  if (!verifyGhlSignature({ signature })) {
    logWebhook("conversations", "❌ invalid signature", {
      signature_present: !!signature,
      signature_preview: signature?.slice(0, 12),
      body_preview: rawBody.slice(0, 200),
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: MessageWebhookPayload
  try {
    payload = JSON.parse(rawBody) as MessageWebhookPayload
  } catch {
    logWebhook("conversations", "❌ invalid JSON", {
      body_preview: rawBody.slice(0, 500),
    })
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Only SMS messages go to the inbox. Email events go through /events route.
  const messageType = (payload.messageType ?? "SMS").toUpperCase()
  if (messageType !== "SMS") {
    logWebhook("conversations", `⏭️ skipped non-SMS (${messageType})`, {
      received_keys: Object.keys(payload),
    })
    return NextResponse.json({ ok: true, ignored: "non-SMS message" })
  }

  const supabase = createServiceRoleClient()

  // 1. Resolve contact. If GHL didn't give us a contactId, look up by phone;
  //    if still not found, auto-create so we never lose an inbound lead.
  const ghlContactId = payload.contactId ?? null
  let localContactId: string | null = null
  if (ghlContactId) {
    const { data } = await supabase
      .from("marketing_contacts")
      .select("id")
      .eq("ghl_contact_id", ghlContactId)
      .maybeSingle()
    localContactId = data?.id ?? null
  }

  if (!localContactId) {
    const phone = normaliseAuPhone(payload.from)
    if (phone) {
      const { data } = await supabase
        .from("marketing_contacts")
        .select("id, ghl_contact_id")
        .eq("phone", phone)
        .maybeSingle()
      if (data) {
        localContactId = data.id
      } else if (ghlContactId) {
        // Not in our mirror yet — fetch full profile from GHL and insert.
        try {
          const full = await GhlContacts.getContact(ghlContactId)
          const result = await mirrorGhlContact(supabase, full, {
            source: "sms_auto_create",
          })
          localContactId = result.contactId
        } catch (err) {
          console.error(
            "[GHL webhook conversations] failed to hydrate contact",
            err,
          )
        }
      }
    }
  }

  if (!localContactId) {
    logWebhook("conversations", "⏭️ dropped — unresolved contact", {
      ghl_contact_id: ghlContactId,
      from: payload.from,
      received_keys: Object.keys(payload),
      full_payload: payload,
      hint:
        "Payload arrived without a contactId we could match locally. If your workflow sends a custom payload, include {{contact.id}} as `contactId`.",
    })
    return NextResponse.json({ ok: true, ignored: "unknown contact" })
  }

  logWebhook("conversations", `✅ accepted (${payload.direction ?? "inbound"})`, {
    conversation_id: payload.conversationId,
    message_id: payload.messageId,
    body_preview: payload.body?.slice(0, 80),
    from: payload.from,
  })

  // 2. Upsert conversation + append message.
  const direction = payload.direction ?? "inbound"
  const body = payload.body ?? ""
  const occurredAt =
    payload.dateAdded ?? payload.timestamp ?? new Date().toISOString()

  const { data: convo } = await supabase
    .from("sms_conversations")
    .upsert(
      {
        ghl_conversation_id: payload.conversationId ?? null,
        contact_id: localContactId,
        last_message_at: occurredAt,
        last_message_preview: body.slice(0, 160),
        last_message_direction: direction,
      },
      { onConflict: "ghl_conversation_id" },
    )
    .select("id, unread_count")
    .maybeSingle()

  if (!convo) {
    return NextResponse.json(
      { error: "Conversation upsert failed" },
      { status: 500 },
    )
  }

  // Bump unread_count for inbound only.
  if (direction === "inbound") {
    await supabase
      .from("sms_conversations")
      .update({ unread_count: (convo.unread_count ?? 0) + 1 })
      .eq("id", convo.id)
  }

  // Idempotent insert. When ghl_message_id is present we use it as the
  // conflict target; when NULL, we rely on the partial unique index on
  // (conversation_id, direction, body, occurred_at) added in migration 034.
  // Either way, a replay of the same webhook doesn't create duplicates.
  const messageRow = {
    ghl_message_id: payload.messageId ?? null,
    conversation_id: convo.id,
    direction,
    body,
    from_number: payload.from ?? null,
    to_number: payload.to ?? null,
    status: mapStatus(direction, payload.status),
    occurred_at: occurredAt,
  }

  if (payload.messageId) {
    const { error: msgError } = await supabase
      .from("sms_messages")
      .upsert(messageRow, {
        onConflict: "ghl_message_id",
        ignoreDuplicates: true,
      })
    if (msgError) {
      console.error("[GHL webhook conversations] message insert", msgError.message)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }
  } else {
    // Fall back to partial index dedupe — try insert, catch duplicate error.
    const { error: msgError } = await supabase
      .from("sms_messages")
      .insert(messageRow)
    if (msgError && !msgError.message.toLowerCase().includes("duplicate")) {
      console.error("[GHL webhook conversations] message insert", msgError.message)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }
  }

  // 3. STOP handling on inbound.
  if (direction === "inbound" && STOP_RE.test(body)) {
    await supabase
      .from("marketing_contacts")
      .update({
        is_opted_out: true,
        opted_out_at: new Date().toISOString(),
        opted_out_reason: "sms_stop",
      })
      .eq("id", localContactId)
    await supabase.from("marketing_audit_log").insert({
      action: "contact.opted_out_sms",
      target_type: "contact",
      target_id: localContactId,
      meta: { message: body.slice(0, 140) },
    })
  }

  // 4. SMS event mirror into marketing_events so the dashboard aggregates.
  if (direction === "inbound") {
    await supabase.from("marketing_events").upsert(
      {
        ghl_event_id: payload.messageId ?? `sms-received-${Date.now()}`,
        event_type: "sms_received",
        contact_id: localContactId,
        ghl_contact_id: ghlContactId,
        metadata: { body: body.slice(0, 200), from: payload.from },
        occurred_at: occurredAt,
      },
      { onConflict: "ghl_event_id", ignoreDuplicates: true },
    )
  }

  return NextResponse.json({ ok: true, conversationId: convo.id })
}

function mapStatus(
  direction: "inbound" | "outbound",
  raw: string | undefined,
): "queued" | "sent" | "delivered" | "failed" | "received" {
  if (direction === "inbound") return "received"
  switch ((raw ?? "").toLowerCase()) {
    case "delivered":
      return "delivered"
    case "failed":
    case "undelivered":
      return "failed"
    case "sent":
      return "sent"
    default:
      return "queued"
  }
}
