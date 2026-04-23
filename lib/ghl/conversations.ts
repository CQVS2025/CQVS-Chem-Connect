/**
 * GoHighLevel conversations / messages API wrapper.
 *
 * Covers:
 *   - Outbound SMS send
 *   - Outbound email send (shared with campaigns.ts)
 *   - Fetch thread + messages for the inbox UI
 *   - Mark messages as read
 *
 * GHL's conversations API is unified: one endpoint `/conversations/messages`
 * accepts a `type` field that dispatches to SMS / Email / FB / IG / etc.
 * We wrap the SMS and Email variants.
 */

import { ghlFetch } from "./client"
import { getGhlConfig } from "./config"

export interface GhlConversation {
  id: string
  contactId: string
  locationId: string
  lastMessageBody?: string
  lastMessageDate?: string
  lastMessageType?: string
  lastMessageDirection?: "inbound" | "outbound"
  unreadCount?: number
  type?: string
}

export interface GhlMessage {
  id: string
  conversationId: string
  contactId?: string
  type: string // SMS, Email, ...
  direction: "inbound" | "outbound"
  body?: string
  status?: string
  dateAdded?: string
  meta?: Record<string, unknown>
}

export interface GhlSendSmsInput {
  contactId: string
  message: string
  toNumber?: string
  fromNumber?: string
}

export interface GhlSendSmsResponse {
  messageId: string
  conversationId?: string
}

export async function sendSmsMessage(
  input: GhlSendSmsInput,
): Promise<GhlSendSmsResponse> {
  return ghlFetch<GhlSendSmsResponse>("/conversations/messages", {
    method: "POST",
    body: {
      type: "SMS",
      contactId: input.contactId,
      message: input.message,
      toNumber: input.toNumber,
      fromNumber: input.fromNumber,
    },
  })
}

export async function listConversations(params: {
  contactId?: string
  limit?: number
  startAfterDate?: number
}): Promise<{ conversations: GhlConversation[] }> {
  const locationId = getGhlConfig().locationId
  return ghlFetch<{ conversations: GhlConversation[] }>("/conversations/search", {
    method: "GET",
    query: {
      locationId,
      contactId: params.contactId,
      limit: params.limit ?? 50,
      startAfterDate: params.startAfterDate,
    },
  })
}

export async function getConversation(
  conversationId: string,
): Promise<GhlConversation> {
  const res = await ghlFetch<{ conversation: GhlConversation } | GhlConversation>(
    `/conversations/${conversationId}`,
  )
  if (typeof (res as { conversation?: GhlConversation }).conversation === "object") {
    return (res as { conversation: GhlConversation }).conversation
  }
  return res as GhlConversation
}

export async function listMessages(
  conversationId: string,
  params: { limit?: number; lastMessageId?: string } = {},
): Promise<{ messages: { messages: GhlMessage[] } }> {
  return ghlFetch<{ messages: { messages: GhlMessage[] } }>(
    `/conversations/${conversationId}/messages`,
    {
      method: "GET",
      query: {
        limit: params.limit ?? 100,
        lastMessageId: params.lastMessageId,
      },
    },
  )
}

export async function markRead(conversationId: string): Promise<void> {
  await ghlFetch(`/conversations/${conversationId}`, {
    method: "PUT",
    body: { unreadCount: 0 },
  })
}
