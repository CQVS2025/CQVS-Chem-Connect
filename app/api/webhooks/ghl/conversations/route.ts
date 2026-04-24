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

/**
 * Two payload shapes we accept:
 *
 * A. Our custom JSON (from CC-Inbound SMS workflow when the admin
 *    configures it explicitly): camelCase keys, flat.
 *
 * B. GHL's default "Customer Replied" payload: snake_case with a nested
 *    `message: { type, body }` block. `phone` instead of `from`, no
 *    `conversationId` / `messageId` / `direction` fields.
 *
 * The handler normalises both into the same internal shape via
 * `normalizePayload()` before running the business logic.
 */
interface MessageWebhookPayload {
  // Our custom-payload shape (camelCase)
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

  // GHL default "Customer Replied" shape (snake_case + nested).
  // NOTE: GHL also sends `date_created` here — it's the CONTACT's creation
  // date, not the message date, so we deliberately don't read it. Server
  // receipt time is the authoritative fallback.
  contact_id?: string
  phone?: string
  message?: {
    type?: number | string
    body?: string
  }
}

interface NormalizedMessage {
  ghlContactId: string | null
  ghlConversationId: string | null
  ghlMessageId: string | null
  direction: "inbound" | "outbound"
  messageType: string
  body: string
  from: string | null
  occurredAt: string
}

function normalizePayload(p: MessageWebhookPayload): NormalizedMessage {
  // GHL's "message.type" is numeric: SMS = 2, most other types are not SMS.
  // When the raw workflow trigger is filtered to SMS channel, we trust it;
  // otherwise we inspect the top-level string field.
  const messageType =
    typeof p.messageType === "string"
      ? p.messageType
      : typeof p.message?.type === "number"
        ? // Numeric codes: 2 = SMS (default for Customer Replied on SMS channel)
          p.message.type === 2
          ? "SMS"
          : String(p.message.type)
        : "SMS"

  return {
    ghlContactId: p.contactId ?? p.contact_id ?? null,
    // GHL's default payload doesn't include conversationId. Fall back to a
    // stable per-contact key so the unique-index upsert groups messages
    // onto one thread instead of creating a new conversation per inbound.
    ghlConversationId:
      p.conversationId ??
      (p.contactId || p.contact_id
        ? `contact:${p.contactId ?? p.contact_id}`
        : null),
    ghlMessageId: p.messageId ?? null,
    direction: p.direction ?? "inbound",
    messageType,
    body: p.body ?? p.message?.body ?? "",
    from: p.from ?? p.phone ?? null,
    // Server receipt time is the safest fallback. Do NOT use
    // `date_created` — GHL's default "Customer Replied" payload surfaces
    // that as the *contact's* creation date, so every inbound from the
    // same contact would collapse onto identical timestamps (and then
    // sort in undefined order in the inbox).
    occurredAt:
      p.dateAdded ?? p.timestamp ?? new Date().toISOString(),
  }
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

  const normalised = normalizePayload(payload)
  const {
    ghlContactId,
    ghlConversationId,
    ghlMessageId,
    direction,
    body,
    occurredAt,
  } = normalised

  // Only SMS messages go to the inbox. Email events go through /events route.
  const messageType = normalised.messageType.toUpperCase()
  if (messageType !== "SMS") {
    logWebhook("conversations", `⏭️ skipped non-SMS (${messageType})`, {
      received_keys: Object.keys(payload),
    })
    return NextResponse.json({ ok: true, ignored: "non-SMS message" })
  }

  const supabase = createServiceRoleClient()

  // 1. Resolve contact. If GHL didn't give us a contactId, look up by phone;
  //    if still not found, auto-create so we never lose an inbound lead.
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
    const phone = normaliseAuPhone(normalised.from ?? undefined)
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

  // Last resort: if we still don't have a local contact but GHL did give us
  // a contactId, hydrate it from GHL (covers the "SMS from a number that
  // isn't in our local mirror yet" case where phone lookup fails because
  // the raw phone doesn't exactly match what we've stored).
  if (!localContactId && ghlContactId) {
    try {
      const full = await GhlContacts.getContact(ghlContactId)
      const result = await mirrorGhlContact(supabase, full, {
        source: "sms_auto_create",
      })
      localContactId = result.contactId
    } catch (err) {
      console.error(
        "[GHL webhook conversations] final-hydrate fallback failed",
        err,
      )
    }
  }

  if (!localContactId) {
    logWebhook("conversations", "⏭️ dropped — unresolved contact", {
      ghl_contact_id: ghlContactId,
      from: normalised.from,
      received_keys: Object.keys(payload),
      full_payload: payload,
      hint:
        "Couldn't match or hydrate a contact from this payload. Check GHL permissions / contact API access.",
    })
    return NextResponse.json({ ok: true, ignored: "unknown contact" })
  }

  logWebhook("conversations", `✅ accepted (${direction})`, {
    conversation_id: ghlConversationId,
    message_id: ghlMessageId,
    body_preview: body.slice(0, 80),
    from: normalised.from,
  })

  // 2. Upsert conversation + append message.
  const { data: convo } = await supabase
    .from("sms_conversations")
    .upsert(
      {
        ghl_conversation_id: ghlConversationId,
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
    ghl_message_id: ghlMessageId,
    conversation_id: convo.id,
    direction,
    body,
    from_number: normalised.from,
    to_number: payload.to ?? null,
    status: mapStatus(direction, payload.status),
    occurred_at: occurredAt,
  }

  if (ghlMessageId) {
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
        ghl_event_id: ghlMessageId ?? `sms-received-${Date.now()}`,
        event_type: "sms_received",
        contact_id: localContactId,
        ghl_contact_id: ghlContactId,
        metadata: { body: body.slice(0, 200), from: normalised.from },
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
