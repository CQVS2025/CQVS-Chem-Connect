/**
 * GoHighLevel contact webhook receiver.
 *
 * Subscribed events (register these inside GHL automations / webhook settings):
 *   - ContactCreate
 *   - ContactUpdate
 *   - ContactDelete
 *   - ContactTagUpdate
 *   - ContactDndUpdate
 *
 * Security:
 *   - HMAC-SHA256 signature verification via GHL_WEBHOOK_SECRET
 *
 * Retry behaviour:
 *   - 401 on invalid signature — GHL should not retry (logged for alerting)
 *   - 400 on missing/malformed payload — GHL should not retry
 *   - 404 / GHLNotFoundError — treated as "already deleted" and returns 200
 *   - 5xx GHL fetch failure — returns 500 so GHL retries later
 *   - DB failure — returns 500 so GHL retries later
 *
 * Idempotency:
 *   - Upserts keyed on ghl_contact_id — replaying the same webhook is safe.
 */

import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  getSignatureHeader,
  verifyGhlSignature,
} from "@/lib/ghl/webhooks"
import {
  mirrorGhlContact,
  softDeleteMirrorContact,
} from "@/lib/ghl/mirror"
import { GhlContacts } from "@/lib/ghl"
import { GHLNotFoundError } from "@/lib/ghl/errors"
import { logWebhook } from "@/lib/ghl/webhook-log"
import type { GhlContact } from "@/lib/ghl/types"

interface GhlContactWebhookPayload {
  // Event metadata — GHL uses several naming conventions across workflow
  // builds, so we accept all known variants and pick the first non-empty.
  type?: string
  eventType?: string
  event?: string
  locationId?: string
  // The contact id can arrive under many keys in practice:
  contactId?: string
  contact_id?: string
  id?: string
  contact?: GhlContact & { id?: string; contactId?: string }
  data?: { contact?: GhlContact & { id?: string }; contactId?: string; id?: string }
  // Fields that may appear flat at the top level (older GHL webhook payloads)
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  tags?: string[]
}

/**
 * Extract the GHL contact id from whatever payload shape we received.
 * GHL's newer webhook actions put data at top level; older ones nest in
 * `contact` or `data.contact`; some flavours put the id at `data.contactId`.
 * We try each in priority order.
 */
function extractContactId(payload: GhlContactWebhookPayload): string | null {
  return (
    payload.contactId ??
    payload.contact_id ??
    payload.id ??
    payload.contact?.id ??
    payload.contact?.contactId ??
    payload.data?.contactId ??
    payload.data?.id ??
    payload.data?.contact?.id ??
    null
  )
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = getSignatureHeader(request)

  if (!verifyGhlSignature({ signature })) {
    logWebhook("contacts", "❌ invalid signature", {
      signature_present: !!signature,
      signature_preview: signature?.slice(0, 12),
      body_preview: rawBody.slice(0, 200),
    })
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: GhlContactWebhookPayload
  try {
    payload = JSON.parse(rawBody) as GhlContactWebhookPayload
  } catch {
    logWebhook("contacts", "❌ invalid JSON", {
      body_preview: rawBody.slice(0, 500),
    })
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType = payload.type ?? payload.eventType ?? payload.event ?? "Unknown"
  const ghlContactId = extractContactId(payload)

  if (!ghlContactId) {
    logWebhook("contacts", "❌ missing contact id", {
      event_type: eventType,
      received_keys: Object.keys(payload),
      full_payload: payload,
      hint:
        "Configure the Webhook action's Custom Data in GHL with {{contact.id}} under a `contactId` field. See docs section 1.4.",
    })
    return NextResponse.json(
      {
        error: "Missing contact id in payload",
        received_keys: Object.keys(payload),
      },
      { status: 400 },
    )
  }

  logWebhook("contacts", `✅ accepted (${eventType})`, {
    event_type: eventType,
    ghl_contact_id: ghlContactId,
  })

  const supabase = createServiceRoleClient()

  try {
    if (eventType === "ContactDelete") {
      await softDeleteMirrorContact(supabase, ghlContactId)
      await logAudit(supabase, "contact.deleted", ghlContactId, { eventType })
      return NextResponse.json({ ok: true, action: "soft-deleted" })
    }

    // For create/update/tag/dnd events, prefer a full fetch to get a consistent
    // snapshot. GHL payload shape varies; this is the simplest way to avoid drift.
    let contact: GhlContact
    try {
      contact =
        payload.contact && payload.contact.id
          ? payload.contact
          : await GhlContacts.getContact(ghlContactId)
    } catch (err) {
      // Contact no longer exists in GHL — safe to ignore and soft-delete locally.
      if (err instanceof GHLNotFoundError) {
        await softDeleteMirrorContact(supabase, ghlContactId)
        await logAudit(supabase, "contact.deleted_404", ghlContactId, {
          eventType,
        })
        return NextResponse.json({
          ok: true,
          action: "soft-deleted (404 from GHL)",
        })
      }
      throw err
    }

    const result = await mirrorGhlContact(supabase, contact, {
      source: "ghl_webhook",
    })

    await logAudit(
      supabase,
      result.created ? "contact.created" : "contact.updated",
      ghlContactId,
      { eventType },
    )

    return NextResponse.json({ ok: true, contactId: result.contactId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[GHL webhook contacts] handler error", {
      eventType,
      ghlContactId,
      message,
    })
    // 500 so GHL retries — our handler is idempotent on ghl_contact_id.
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function logAudit(
  supabase: ReturnType<typeof createServiceRoleClient>,
  action: string,
  targetId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await supabase.from("marketing_audit_log").insert({
    action,
    target_type: "contact",
    target_id: targetId,
    meta,
  })
}
