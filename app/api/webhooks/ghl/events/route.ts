/**
 * GoHighLevel email / SMS event webhook receiver.
 *
 * Security: shared-token header `x-ghl-signature`.
 *
 * Correctness:
 * - Idempotent on a stable ghl_event_id. When GHL omits the id, we derive
 *   one from (messageId + eventType) so replays dedupe correctly.
 * - Campaign attribution is done by messageId lookup — the dispatcher wrote
 *   an attribution anchor (`delivered` event with message_id in metadata)
 *   when sending, and we join against that. No more guessing the "most
 *   recent campaign".
 * - Counter bumps use the atomic `bump_campaign_counter` RPC so concurrent
 *   events don't lose increments.
 */

import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  getSignatureHeader,
  verifyGhlSignature,
} from "@/lib/ghl/webhooks"
import { logWebhook } from "@/lib/ghl/webhook-log"

type EventType =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed"
  | "sms_delivered"
  | "sms_failed"
  | "sms_received"

interface EventPayload {
  // Event type — GHL wraps this many ways depending on trigger + custom data.
  type?: string
  eventType?: string
  event?: string
  event_type?: string
  // Nested under workflow-action customData / triggerData
  customData?: {
    type?: string
    event_type?: string
    event?: string
    eventType?: string
  }
  triggerData?: {
    type?: string
    event?: string
    eventType?: string
    name?: string
  }
  workflow?: { id?: string; name?: string }

  // Identifiers — camelCase + snake_case, top-level or nested
  locationId?: string
  contactId?: string
  contact_id?: string
  id?: string
  messageId?: string
  message_id?: string
  campaignId?: string
  bulkActionId?: string
  eventId?: string

  email?: string
  phone?: string
  url?: string
  userAgent?: string
  timestamp?: string
  occurredAt?: string
}

const TYPE_MAP: Record<string, EventType> = {
  emaildelivered: "delivered",
  emailopened: "opened",
  emailclicked: "clicked",
  emailbounced: "bounced",
  emailcomplained: "complained",
  emailunsubscribed: "unsubscribed",
  emailfailed: "failed",
  emaildelivery: "delivered",
  emailopen: "opened",
  emailclick: "clicked",
  emailbounce: "bounced",
  smsdelivered: "sms_delivered",
  smsfailed: "sms_failed",
  smsreceived: "sms_received",
  smsreply: "sms_received",
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  bounced: "bounced",
  complained: "complained",
  unsubscribed: "unsubscribed",
  failed: "failed",
}

const COUNTER_COLUMN: Partial<Record<EventType, string>> = {
  delivered: "delivered_count",
  opened: "opened_count",
  clicked: "clicked_count",
  bounced: "bounced_count",
  unsubscribed: "unsubscribed_count",
  failed: "failed_count",
  sms_delivered: "delivered_count",
  sms_failed: "failed_count",
}

function normaliseEventType(raw: string | undefined): EventType | null {
  if (!raw) return null
  const key = raw.toLowerCase().replace(/[^a-z]/g, "")
  return TYPE_MAP[key] ?? null
}

/**
 * Fallback: infer event type from the GHL workflow name.
 *
 * GHL's Email Event trigger doesn't surface the event type in the payload
 * (confirmed via raw header + body dump). Template variables like
 * {{trigger.name}} resolve to empty strings. The only signal we consistently
 * have is `workflow.name`, so we look for keywords in it.
 *
 * This means the user's workflow naming convention matters:
 *   "CC — Email Opened" -> opened
 *   "CC — Email Clicked" -> clicked
 *   "CC — Bounced emails" -> bounced
 *
 * Checked in priority order to avoid conflicts (e.g. "unsubscribed" before
 * "subscribe").
 */
const WORKFLOW_NAME_PATTERNS: Array<[RegExp, EventType]> = [
  [/\bunsubscrib(?:e|ed)\b/i, "unsubscribed"],
  [/\bcomplain(?:t|ed)?\b|\bspam\b/i, "complained"],
  [/\bbounced?\b/i, "bounced"],
  [/\bclicked?\b/i, "clicked"],
  [/\bopened?\b|\bopen\b/i, "opened"],
  [/\bdelivered?\b/i, "delivered"],
  [/\bfailed?\b/i, "failed"],
]

function inferFromWorkflowName(name: string | undefined): EventType | null {
  if (!name) return null
  for (const [re, type] of WORKFLOW_NAME_PATTERNS) {
    if (re.test(name)) return type
  }
  return null
}

/**
 * Build a stable idempotency key.
 *
 * Priority:
 *   1. GHL's own eventId if provided (deterministic across retries).
 *   2. messageId-based (deterministic per message).
 *   3. (eventType + contactId + campaignId + hour-bucket) — fallback used when
 *      GHL omits messageId (common for Email Event workflow triggers). The
 *      campaignId is critical: without it, two different campaigns opened by
 *      the same contact in the same hour collapse into one event, under-
 *      counting the second campaign's opens.
 *   4. (eventType + contactId + hour-bucket) as a last resort if we couldn't
 *      attribute to a campaign at all.
 *
 * Dedup boundary: one (eventType, contact, campaign) pair per hour. So if a
 * contact opens the same email 10 times in 30 minutes it still counts as
 * 1 open for that campaign. If they open campaign A and then campaign B in
 * the same hour, each counts once.
 */
function buildEventKey(
  payload: EventPayload,
  eventType: EventType,
  campaignId: string | null,
): string | null {
  if (payload.eventId) return payload.eventId
  const messageId = payload.messageId ?? payload.message_id
  const contactId = payload.contactId ?? payload.contact_id
  if (messageId) return `${eventType}:${messageId}`
  if (contactId && payload.timestamp) {
    return `${eventType}:${contactId}:${payload.timestamp}`
  }
  if (contactId && campaignId) {
    const bucket = Math.floor(Date.now() / 3_600_000)
    return `${eventType}:${contactId}:c${campaignId}:h${bucket}`
  }
  if (contactId) {
    const bucket = Math.floor(Date.now() / 3_600_000)
    return `${eventType}:${contactId}:h${bucket}`
  }
  return null
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = getSignatureHeader(request)

  // DEBUG: full dump of what GHL sends — headers, method, query, body.
  // Keeps us honest about what info actually arrives per event type.
  const headerDump: Record<string, string> = {}
  request.headers.forEach((v, k) => {
    // Redact the signature — no value in exposing our secret in logs.
    headerDump[k] = k.toLowerCase().includes("signature") ? `${v.slice(0, 6)}…` : v
  })
  const url = new URL(request.url)
  const queryDump: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    queryDump[k] = v
  })
  logWebhook("events", "📨 raw inbound", {
    method: request.method,
    url: url.pathname + (url.search || ""),
    headers: headerDump,
    query: queryDump,
    body_raw: rawBody,
  })

  if (!verifyGhlSignature({ signature })) {
    logWebhook("events", "❌ invalid signature", {
      signature_present: !!signature,
      signature_preview: signature?.slice(0, 12),
      body_preview: rawBody.slice(0, 200),
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: EventPayload
  try {
    payload = JSON.parse(rawBody) as EventPayload
  } catch {
    logWebhook("events", "❌ invalid JSON", {
      body_preview: rawBody.slice(0, 500),
    })
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // GHL's workflow webhook payload can surface the event type in many places
  // depending on how Custom Data is configured. Check all of them, treating
  // empty strings as "not set" (the template variable didn't resolve).
  const firstNonEmpty = (...vals: Array<string | undefined>) =>
    vals.find((v) => typeof v === "string" && v.trim().length > 0)

  const rawType = firstNonEmpty(
    payload.type,
    payload.eventType,
    payload.event,
    payload.event_type,
    payload.customData?.type,
    payload.customData?.event_type,
    payload.customData?.event,
    payload.customData?.eventType,
    payload.triggerData?.type,
    payload.triggerData?.event,
    payload.triggerData?.eventType,
    payload.triggerData?.name,
  )
  // Primary: explicit type from payload. Fallback: infer from workflow.name.
  const eventType =
    normaliseEventType(rawType) ?? inferFromWorkflowName(payload.workflow?.name)
  if (!eventType) {
    logWebhook("events", "❌ unknown event type", {
      raw_type: rawType,
      workflow_name: payload.workflow?.name,
      received_keys: Object.keys(payload),
      full_payload: payload,
      body_length: rawBody.length,
      hint:
        "Either: (a) hardcode a 'type' field in the workflow's Webhook Custom Data (e.g. type=opened), OR (b) name the GHL workflow with the event keyword (e.g. 'CC — Email Opened') and our parser will auto-detect.",
    })
    return NextResponse.json(
      {
        error: `Unknown event type: ${rawType ?? "(missing)"}`,
        workflow_name: payload.workflow?.name,
        hint:
          "Name the GHL workflow with one of these keywords so we can auto-detect: opened, clicked, bounced, unsubscribed, complained, delivered, failed. Or hardcode a 'type' in the webhook's Custom Data.",
      },
      { status: 400 },
    )
  }

  const ghlContactId =
    payload.contactId ?? payload.contact_id ?? payload.id ?? null
  const messageIdFromPayload = payload.messageId ?? payload.message_id ?? null
  const occurredAt =
    payload.occurredAt ?? payload.timestamp ?? new Date().toISOString()

  const supabase = createServiceRoleClient()

  const { data: contact } = ghlContactId
    ? await supabase
        .from("marketing_contacts")
        .select("id")
        .eq("ghl_contact_id", ghlContactId)
        .maybeSingle()
    : { data: null }

  // Attribution: look up campaign by messageId via the anchor row the
  // dispatcher wrote at send time. This is deterministic, unlike the
  // previous "most recent sent campaign" heuristic.
  let campaignId: string | null = null
  let attributionMode: "message_id" | "bulk_action" | "recent_contact" | "none" =
    "none"

  // 1. Preferred: exact lookup by messageId via the anchor row the dispatcher
  //    wrote at send time. Deterministic.
  if (messageIdFromPayload) {
    const { data: anchor } = await supabase
      .from("marketing_events")
      .select("campaign_id")
      .eq("metadata->>message_id", messageIdFromPayload)
      .not("campaign_id", "is", null)
      .limit(1)
      .maybeSingle()
    campaignId = (anchor?.campaign_id as string | undefined) ?? null
    if (campaignId) attributionMode = "message_id"
  }

  // 2. Explicit bulkActionId if GHL ever sends one.
  if (!campaignId && payload.bulkActionId) {
    const { data: byBulk } = await supabase
      .from("marketing_campaigns")
      .select("id")
      .eq("ghl_bulk_action_id", payload.bulkActionId)
      .maybeSingle()
    campaignId = (byBulk?.id as string | undefined) ?? null
    if (campaignId) attributionMode = "bulk_action"
  }

  // 3. Fallback — GHL doesn't give us message.id for Email Event triggers, so
  //    find the most recent attribution anchor for THIS contact in the last
  //    30 days. Correct for the common case where the contact's received one
  //    campaign recently; imprecise only if they received several overlapping
  //    campaigns. The alternative is orphaned events with no attribution.
  if (!campaignId && ghlContactId) {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString()
    const { data: recentAnchor } = await supabase
      .from("marketing_events")
      .select("campaign_id, occurred_at")
      .eq("ghl_contact_id", ghlContactId)
      .eq("metadata->>attribution_anchor", "true")
      .not("campaign_id", "is", null)
      .gte("occurred_at", thirtyDaysAgo)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    campaignId = (recentAnchor?.campaign_id as string | undefined) ?? null
    if (campaignId) attributionMode = "recent_contact"
  }

  // Build the idempotency key AFTER attribution so campaignId can scope the
  // hour-bucket fallback. Otherwise two different campaigns opened by the
  // same contact in the same hour would collapse into one event.
  const ghlEventId = buildEventKey(payload, eventType, campaignId)
  if (!ghlEventId) {
    return NextResponse.json(
      { error: "Payload missing enough identifiers to build idempotency key" },
      { status: 400 },
    )
  }

  logWebhook("events", "✅ accepted", {
    event_type: eventType,
    raw_type: rawType,
    attribution_mode: attributionMode,
    campaign_id: campaignId,
    contact_id: ghlContactId,
    message_id: messageIdFromPayload,
  })

  // Idempotent insert.
  const { data: inserted, error: insertError } = await supabase
    .from("marketing_events")
    .upsert(
      {
        ghl_event_id: ghlEventId,
        event_type: eventType,
        campaign_id: campaignId,
        contact_id: contact?.id ?? null,
        ghl_contact_id: ghlContactId,
        metadata: {
          url: payload.url,
          userAgent: payload.userAgent,
          email: payload.email,
          phone: payload.phone,
          message_id: messageIdFromPayload,
        },
        occurred_at: occurredAt,
      },
      { onConflict: "ghl_event_id", ignoreDuplicates: true },
    )
    .select("id, campaign_id, event_type")
    .maybeSingle()

  if (insertError) {
    console.error("[GHL webhook events] insert failed", insertError.message)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Diagnostic: log whether upsert resulted in a new row or was deduplicated.
  logWebhook("events", "💾 upsert result", {
    inserted_id: inserted?.id ?? null,
    inserted_campaign_id: inserted?.campaign_id ?? null,
    deduped: !inserted,
    ghl_event_id_used: ghlEventId,
  })

  if (inserted) {
    if (inserted.campaign_id) {
      const column = COUNTER_COLUMN[eventType]
      if (column) {
        // Atomic bump via RPC so concurrent events don't race.
        const { error: rpcError } = await supabase.rpc("bump_campaign_counter", {
          p_campaign_id: inserted.campaign_id,
          p_column: column,
          p_delta: 1,
        })
        if (rpcError) {
          logWebhook("events", "❌ counter bump failed", {
            campaign_id: inserted.campaign_id,
            column,
            error: rpcError.message,
          })
        } else {
          logWebhook("events", "➕ counter bumped", {
            campaign_id: inserted.campaign_id,
            column,
          })
        }
      } else {
        logWebhook("events", "⏭️ no counter column for event", {
          event_type: eventType,
        })
      }
    } else {
      logWebhook("events", "⏭️ no campaign_id, counter not bumped", {
        inserted_id: inserted.id,
      })
    }
    if (
      (eventType === "unsubscribed" || eventType === "complained") &&
      contact?.id
    ) {
      await supabase
        .from("marketing_contacts")
        .update({
          is_opted_out: true,
          opted_out_at: new Date().toISOString(),
          opted_out_reason: eventType,
        })
        .eq("id", contact.id)
    }
  }

  return NextResponse.json({
    ok: true,
    eventType,
    attributed: !!campaignId,
    duplicate: !inserted,
  })
}
