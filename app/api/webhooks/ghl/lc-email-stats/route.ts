/**
 * GoHighLevel LCEmailStats webhook — deterministic per-message attribution.
 *
 * This is GHL's Marketplace-App webhook (different from the workflow "Email
 * Event" trigger at /api/webhooks/ghl/events). The workflow trigger omits
 * messageId, which breaks attribution when two campaigns are sent to the
 * same contact seconds apart. LCEmailStats includes the SMTP Message-ID
 * header on every event, so opens/clicks map to a specific outbound email.
 *
 * Event flow:
 *   1. Dispatcher sends email -> writes anchor row keyed by GHL messageId.
 *      If GHL's send response returns `emailMessageId`, that's stored too.
 *   2. GHL fires LCEmailStats `delivered` with the SMTP message-id. We
 *      match against the anchor (preferring `email_message_id`, falling
 *      back to most recent send to the same recipient) and upsert the
 *      email_message_id onto the anchor so subsequent events are O(1).
 *   3. `opened` / `clicked` / `bounced` / `complained` / `unsubscribed` all
 *      carry the same SMTP message-id, so attribution is exact.
 *
 * Security: Ed25519-signed by GHL. We verify the raw body against their
 * published public key (see GHL_WEBHOOK_PUBLIC_KEY in env).
 *
 * Counter writes: bumps the relevant `marketing_campaigns.*_count` column
 * via `bump_campaign_counter` RPC, **except** for `delivered` — the
 * dispatcher already sets `delivered_count` directly from the number of
 * successful API handoffs, so double-counting would occur.
 */

import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { verifyGhlEd25519 } from "@/lib/ghl/webhooks"
import { logWebhook } from "@/lib/ghl/webhook-log"

type EventType =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed"

const EVENT_MAP: Record<string, EventType> = {
  accepted: "delivered",
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  bounced: "bounced",
  failed: "failed",
  complained: "complained",
  spam: "complained",
  spammed: "complained",
  unsubscribed: "unsubscribed",
}

const COUNTER_COLUMN: Partial<Record<EventType, string>> = {
  // `delivered` intentionally omitted — dispatcher writes it directly.
  opened: "opened_count",
  clicked: "clicked_count",
  bounced: "bounced_count",
  unsubscribed: "unsubscribed_count",
  failed: "failed_count",
}

interface LCPayload {
  type?: string
  locationId?: string
  companyId?: string
  webhookPayload?: {
    event?: string
    id?: string
    timestamp?: number
    recipient?: string
    url?: string
    tags?: string[]
    campaigns?: unknown[]
    message?: {
      headers?: {
        "message-id"?: string
        from?: string
        to?: string
      }
    }
    // GHL's internal per-email identifier — this is what the send
    // response from POST /conversations/messages returns as emailMessageId,
    // and what our dispatcher stores in the anchor as `email_message_id`.
    // It is the authoritative attribution key, not the SMTP message-id
    // header. Both are present; always prefer this one.
    "lc-operations"?: {
      email_message_id?: string
      email_type?: string
      location_id?: string
      company_id?: string
    }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature =
    request.headers.get("x-ghl-signature") ??
    request.headers.get("x-wh-signature")

  const headerDump: Record<string, string> = {}
  request.headers.forEach((v, k) => {
    headerDump[k] = k.toLowerCase().includes("signature")
      ? `${v.slice(0, 12)}…`
      : v
  })
  logWebhook("lc-email-stats", "📨 raw inbound", {
    headers: headerDump,
    body_raw: rawBody.slice(0, 2000),
  })

  const verified = verifyGhlEd25519({ rawBody, signature })
  if (!verified.ok) {
    logWebhook("lc-email-stats", "❌ signature verify failed", {
      reason: verified.reason,
      signature_present: !!signature,
    })
    return NextResponse.json(
      { error: "Invalid signature", reason: verified.reason },
      { status: 401 },
    )
  }

  let payload: LCPayload
  try {
    payload = JSON.parse(rawBody) as LCPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // GHL reuses this same webhook URL for install lifecycle events
  // (INSTALL / UNINSTALL) and for real LCEmailStats events. Lifecycle
  // events don't carry a `webhookPayload` — just acknowledge them 200
  // so GHL doesn't mark the URL as unhealthy.
  const envelopeType = (payload.type ?? "").toLowerCase()
  if (envelopeType === "install" || envelopeType === "uninstall") {
    logWebhook("lc-email-stats", `ℹ️ ${envelopeType} notification`, {
      locationId: (payload as unknown as { locationId?: string }).locationId,
      companyId: payload.companyId ?? null,
    })
    return NextResponse.json({ ok: true, type: envelopeType })
  }

  const inner = payload.webhookPayload
  if (!inner) {
    logWebhook("lc-email-stats", "⏭️ no webhookPayload — unknown envelope", {
      envelope_type: payload.type,
    })
    return NextResponse.json({ ok: true, skipped: true })
  }

  const rawEvent = (inner.event ?? "").toLowerCase()
  const eventType = EVENT_MAP[rawEvent] ?? null
  if (!eventType) {
    logWebhook("lc-email-stats", "⏭️ unhandled event", { raw_event: rawEvent })
    return NextResponse.json({ ok: true, skipped: true, raw_event: rawEvent })
  }

  // Two identifiers in every LCEmailStats event:
  //   1. lc-operations.email_message_id — GHL's internal per-email ID.
  //      This matches what the send API returns as `emailMessageId`, so it's
  //      what the dispatcher stored in the anchor. PRIMARY attribution key.
  //   2. message.headers["message-id"] — SMTP RFC 5322 Message-ID. Useful
  //      for logs and human correlation but the dispatcher doesn't capture
  //      it, so it can't anchor by this value.
  const lcEmailMessageId =
    inner["lc-operations"]?.email_message_id ?? null
  const rawSmtpId = inner.message?.headers?.["message-id"] ?? null
  const smtpMessageId = rawSmtpId ? rawSmtpId.replace(/^<|>$/g, "") : null
  const recipient = inner.recipient?.toLowerCase() ?? null

  if (!lcEmailMessageId && !smtpMessageId) {
    logWebhook("lc-email-stats", "❌ no message identifiers in payload", {
      inner,
    })
    return NextResponse.json(
      { error: "Missing message identifiers" },
      { status: 400 },
    )
  }

  const occurredAt = inner.timestamp
    ? new Date(inner.timestamp * 1000).toISOString()
    : new Date().toISOString()

  const supabase = createServiceRoleClient()

  let campaignId: string | null = null
  let contactRowId: string | null = null
  let ghlContactId: string | null = null
  let isTestSend = false
  let attributionMode:
    | "lc_email_message_id"
    | "message_id"
    | "recipient_recent"
    | "none" = "none"

  // 1. Primary: match on GHL's lc-operations.email_message_id against the
  //    anchor's metadata.email_message_id (stored by the dispatcher from
  //    the send response).
  if (lcEmailMessageId) {
    const { data: byLcId } = await supabase
      .from("marketing_events")
      .select("campaign_id, contact_id, ghl_contact_id, metadata")
      .eq("metadata->>email_message_id", lcEmailMessageId)
      .eq("metadata->>attribution_anchor", "true")
      .not("campaign_id", "is", null)
      .limit(1)
      .maybeSingle()
    if (byLcId) {
      campaignId = byLcId.campaign_id as string
      contactRowId = (byLcId.contact_id as string | null) ?? null
      ghlContactId = (byLcId.ghl_contact_id as string | null) ?? null
      isTestSend =
        (byLcId.metadata as { is_test?: boolean } | null)?.is_test === true
      attributionMode = "lc_email_message_id"
    }
  }

  // 2. Fallback: conversation messageId (if our dispatcher stored it and
  //    the SMTP message-id happens to include it). Cheap to try.
  if (!campaignId && smtpMessageId) {
    const { data: byMsgId } = await supabase
      .from("marketing_events")
      .select("campaign_id, contact_id, ghl_contact_id, metadata")
      .eq("metadata->>message_id", smtpMessageId)
      .eq("metadata->>attribution_anchor", "true")
      .not("campaign_id", "is", null)
      .limit(1)
      .maybeSingle()
    if (byMsgId) {
      campaignId = byMsgId.campaign_id as string
      contactRowId = (byMsgId.contact_id as string | null) ?? null
      ghlContactId = (byMsgId.ghl_contact_id as string | null) ?? null
      isTestSend =
        (byMsgId.metadata as { is_test?: boolean } | null)?.is_test === true
      attributionMode = "message_id"
    }
  }

  // 3. Recipient fallback — when the dispatcher couldn't capture
  //    emailMessageId at send time (old sends or API response variability),
  //    we match the most recent anchor for this recipient that hasn't
  //    already been bound to an lc-operations.email_message_id. Then we
  //    write that id onto the anchor so future events resolve via case 1.
  if (!campaignId && recipient) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString()
    const { data: anchor } = await supabase
      .from("marketing_events")
      .select("id, campaign_id, contact_id, ghl_contact_id, metadata")
      .eq("metadata->>recipient_email", recipient)
      .eq("metadata->>attribution_anchor", "true")
      .gte("occurred_at", thirtyMinAgo)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (anchor) {
      const meta = (anchor.metadata ?? {}) as Record<string, unknown>
      const alreadyBound = !!meta.email_message_id
      campaignId = anchor.campaign_id as string
      contactRowId = (anchor.contact_id as string | null) ?? null
      ghlContactId = (anchor.ghl_contact_id as string | null) ?? null
      isTestSend = meta.is_test === true
      attributionMode = "recipient_recent"

      // Upsert the lc-operations.email_message_id onto the anchor for
      // O(1) attribution on future opens/clicks of this same email.
      if (!alreadyBound && lcEmailMessageId) {
        await supabase
          .from("marketing_events")
          .update({
            metadata: { ...meta, email_message_id: lcEmailMessageId },
          })
          .eq("id", anchor.id as string)
      }
    }
  }

  logWebhook("lc-email-stats", "✅ accepted", {
    event_type: eventType,
    lc_email_message_id: lcEmailMessageId,
    smtp_message_id: smtpMessageId,
    recipient,
    campaign_id: campaignId,
    attribution_mode: attributionMode,
    is_test: isTestSend,
  })

  // Stable idempotency: prefer GHL's own event id, else the lc id, else smtp.
  const ghlEventId = inner.id
    ? `lc:${inner.id}`
    : `lc:${eventType}:${lcEmailMessageId ?? smtpMessageId}`

  const { data: inserted, error: insertError } = await supabase
    .from("marketing_events")
    .upsert(
      {
        ghl_event_id: ghlEventId,
        event_type: eventType,
        campaign_id: campaignId,
        contact_id: contactRowId,
        ghl_contact_id: ghlContactId,
        metadata: {
          source: "lc-email-stats",
          lc_email_message_id: lcEmailMessageId,
          smtp_message_id: smtpMessageId,
          recipient,
          url: inner.url,
          tags: inner.tags,
          is_test: isTestSend || undefined,
        },
        occurred_at: occurredAt,
      },
      { onConflict: "ghl_event_id", ignoreDuplicates: true },
    )
    .select("id, campaign_id, event_type")
    .maybeSingle()

  if (insertError) {
    logWebhook("lc-email-stats", "❌ insert failed", {
      error: insertError.message,
    })
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  logWebhook("lc-email-stats", "💾 upsert result", {
    inserted_id: inserted?.id ?? null,
    inserted_campaign_id: inserted?.campaign_id ?? null,
    deduped: !inserted,
    ghl_event_id_used: ghlEventId,
  })

  // Counter bump: only for the FIRST event of this type for this email.
  // Dashboards show *unique* opens / clicks per recipient per email — the
  // industry standard. Subsequent opens/clicks of the same email get
  // recorded as events (audit trail stays complete) but don't inflate the
  // rate. Without this check, a recipient opening an email twice yields a
  // 200% open rate, which is what the user noticed.
  //
  // Test sends (is_test=true on the anchor) are attributed to the campaign
  // for auditing / Recent Events visibility but never bump the counters.
  // Otherwise a test-send to yourself, opened twice while previewing, would
  // pollute the campaign's "opened_count" before the real send fires.
  if (inserted && inserted.campaign_id && lcEmailMessageId && !isTestSend) {
    const column = COUNTER_COLUMN[eventType]
    if (column) {
      const { count: priorCount, error: countError } = await supabase
        .from("marketing_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", eventType)
        .eq("metadata->>lc_email_message_id", lcEmailMessageId)
        .neq("id", inserted.id as string)

      if (countError) {
        logWebhook("lc-email-stats", "❌ dedupe-count failed", {
          error: countError.message,
        })
      } else if ((priorCount ?? 0) > 0) {
        logWebhook("lc-email-stats", "⏭️ counter skipped — already counted", {
          campaign_id: inserted.campaign_id,
          column,
          prior_events: priorCount,
        })
      } else {
        const { error: rpcError } = await supabase.rpc(
          "bump_campaign_counter",
          {
            p_campaign_id: inserted.campaign_id,
            p_column: column,
            p_delta: 1,
          },
        )
        if (rpcError) {
          logWebhook("lc-email-stats", "❌ counter bump failed", {
            campaign_id: inserted.campaign_id,
            column,
            error: rpcError.message,
          })
        } else {
          logWebhook("lc-email-stats", "➕ counter bumped", {
            campaign_id: inserted.campaign_id,
            column,
          })
        }
      }
    }
  } else if (inserted && inserted.campaign_id && isTestSend) {
    logWebhook("lc-email-stats", "⏭️ counter skipped — test send", {
      campaign_id: inserted.campaign_id,
      event_type: eventType,
    })
  }

  if (
    inserted &&
    (eventType === "unsubscribed" || eventType === "complained") &&
    contactRowId
  ) {
    await supabase
      .from("marketing_contacts")
      .update({
        is_opted_out: true,
        opted_out_at: new Date().toISOString(),
        opted_out_reason: eventType,
      })
      .eq("id", contactRowId)
  }

  return NextResponse.json({
    ok: true,
    eventType,
    attributed: !!campaignId,
    attributionMode,
    duplicate: !inserted,
  })
}
