/**
 * GoHighLevel campaigns / emails / bulk-actions API wrapper.
 *
 * Sending path: POST /conversations/messages with type=Email.
 * GHL batches internally and tracks events.
 *
 * Payload field names (verified against real GHL 422 responses, April 2026):
 *   type      = "Email"
 *   contactId = target contact
 *   subject   = required
 *   html      = HTML body (GHL inlines CSS, injects tracking + unsubscribe)
 *   emailFrom = bare email address; the "Name <addr>" RFC-5322 syntax is rejected
 *
 * Fields we deliberately do NOT send:
 *   replyTo         — on this endpoint, `replyTo` is a threading-mode enum
 *                     (reply/replyAll/forward), NOT the Reply-To email header.
 *                     Passing an email address triggers "must be a valid
 *                     enum value" 422. Custom Reply-To must be configured on
 *                     the GHL sub-account profile if needed.
 *   emailReplyMode  — only valid when replying to an existing inbound thread.
 *   Display name    — not a field on this endpoint. Configure the sender's
 *                     display name on the sub-account's Business Profile in
 *                     GHL (Settings → Email Services).
 */

import { ghlFetch } from "./client"
import { getGhlConfig } from "./config"

export interface GhlEmailSend {
  contactId: string
  subject: string
  html: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
}

export interface GhlEmailSendResponse {
  messageId: string
  conversationId?: string
  /**
   * SMTP-layer identifier. Matches the `message-id` header carried by the
   * LCEmailStats webhook, which is how we attribute opens/clicks to a
   * specific outbound email even when two campaigns fire to the same
   * contact back-to-back. Not always returned — we fall back to a
   * recipient-based match on `delivered` events when absent.
   */
  emailMessageId?: string
}

/**
 * Send a single email to a single contact via GHL conversations.
 * If fromEmail is omitted the sub-account default is used.
 */
export async function sendEmailMessage(
  input: GhlEmailSend,
): Promise<GhlEmailSendResponse> {
  const body: Record<string, unknown> = {
    type: "Email",
    contactId: input.contactId,
    subject: input.subject,
    html: input.html,
  }
  if (input.fromEmail) body.emailFrom = input.fromEmail
  // Intentionally no replyTo / emailReplyMode / fromName — see file header.
  return ghlFetch<GhlEmailSendResponse>("/conversations/messages", {
    method: "POST",
    body,
  })
}

export interface BatchEmailResult {
  contactId: string
  ok: boolean
  messageId?: string
  error?: string
}

export async function sendEmailToMany(
  recipients: Array<{ contactId: string }>,
  template: Omit<GhlEmailSend, "contactId">,
  options: {
    pauseMs?: number
    onProgress?: (done: number, total: number) => void
  } = {},
): Promise<BatchEmailResult[]> {
  const pauseMs = options.pauseMs ?? 150
  const results: BatchEmailResult[] = []

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    try {
      const res = await sendEmailMessage({ ...template, contactId: r.contactId })
      results.push({ contactId: r.contactId, ok: true, messageId: res.messageId })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ contactId: r.contactId, ok: false, error: message })
    }
    options.onProgress?.(i + 1, recipients.length)
    if (pauseMs > 0 && i < recipients.length - 1) {
      await sleep(pauseMs)
    }
  }

  return results
}

/**
 * Lookup contacts by tag — used by the campaign dispatcher to resolve the
 * "audience" jsonb filter into a list of GHL contact IDs.
 */
export async function listContactIdsByTag(tag: string): Promise<string[]> {
  const locationId = getGhlConfig().locationId
  const ids: string[] = []
  let startAfter: number | undefined
  let startAfterId: string | undefined

  while (true) {
    const res = await ghlFetch<{
      contacts: Array<{ id: string; dateAdded?: string }>
    }>("/contacts/", {
      method: "GET",
      query: {
        locationId,
        limit: 100,
        query: tag,
        startAfter,
        startAfterId,
      },
    })
    const contacts = res.contacts ?? []
    for (const c of contacts) ids.push(c.id)
    if (contacts.length < 100) break
    const last = contacts[contacts.length - 1]
    if (!last?.dateAdded) break
    startAfter = new Date(last.dateAdded).getTime()
    startAfterId = last.id
    if (ids.length > 20000) break
  }
  return ids
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
