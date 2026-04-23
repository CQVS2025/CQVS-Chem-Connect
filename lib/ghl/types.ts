/**
 * TypeScript types for GoHighLevel API entities.
 *
 * Only what we actually use — grows as new endpoints are wired up.
 * GHL v2 API responses wrap payloads under a resource key (e.g. `{ contact: {...} }`,
 * `{ contacts: [...] }`). We normalise away from the wrapper shape inside the
 * lib so the rest of the codebase never sees it.
 */

export interface GhlContact {
  id: string
  locationId: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  contactName?: string
  companyName?: string
  website?: string
  address1?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  source?: string
  tags?: string[]
  dnd?: boolean
  dateAdded?: string
  dateUpdated?: string
  customFields?: Array<{
    id: string
    key?: string
    value?: string | number | boolean | string[]
  }>
}

export interface GhlContactListResponse {
  contacts: GhlContact[]
  meta?: {
    total?: number
    nextPageUrl?: string
    startAfter?: number
    startAfterId?: string
    currentPage?: number
    nextPage?: number
    prevPage?: number
  }
}

export interface GhlContactInput {
  locationId?: string
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  name?: string
  companyName?: string
  address1?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  tags?: string[]
  source?: string
  customFields?: Record<string, unknown>
}

export interface GhlLocation {
  id: string
  name: string
  companyId?: string
  email?: string
  phone?: string
  timezone?: string
  country?: string
  state?: string
  address?: string
}

export interface GhlWorkflow {
  id: string
  name: string
  status?: "published" | "draft"
  locationId?: string
  version?: number
  createdAt?: string
  updatedAt?: string
}

export interface GhlConversation {
  id: string
  contactId: string
  locationId: string
  lastMessageBody?: string
  lastMessageDate?: string
  lastMessageDirection?: "inbound" | "outbound"
  unreadCount?: number
}

export interface GhlMessage {
  id: string
  conversationId: string
  type: string                 // "SMS" | "Email" | ...
  direction: "inbound" | "outbound"
  body?: string
  status?: string
  dateAdded?: string
}

export interface GhlSendSmsInput {
  contactId: string
  message: string
  toNumber?: string
  fromNumber?: string
}
