/**
 * GoHighLevel Contacts API wrapper.
 *
 * Thin, typed layer over /contacts endpoints. Responsible only for talking
 * to GHL — local caching / mirroring happens in the sync layer.
 *
 * GHL v2 paginates by `startAfter` (date) + `startAfterId`. We expose a
 * simple `listAllContacts()` generator that handles the paging internally.
 */

import { ghlFetch } from "./client"
import { getGhlConfig } from "./config"
import type {
  GhlContact,
  GhlContactInput,
  GhlContactListResponse,
} from "./types"

const DEFAULT_PAGE_SIZE = 100

export interface ListContactsParams {
  query?: string
  limit?: number
  startAfter?: number
  startAfterId?: string
  locationId?: string
}

export async function listContacts(
  params: ListContactsParams = {},
): Promise<GhlContactListResponse> {
  const locationId = params.locationId ?? getGhlConfig().locationId
  return ghlFetch<GhlContactListResponse>("/contacts/", {
    method: "GET",
    query: {
      locationId,
      limit: params.limit ?? DEFAULT_PAGE_SIZE,
      query: params.query,
      startAfter: params.startAfter,
      startAfterId: params.startAfterId,
    },
  })
}

/**
 * Async generator that yields every contact in the location, paginating
 * transparently. Use `for await (const contact of listAllContacts())`.
 */
export async function* listAllContacts(
  params: Omit<ListContactsParams, "startAfter" | "startAfterId"> = {},
): AsyncGenerator<GhlContact, void, void> {
  let startAfter: number | undefined
  let startAfterId: string | undefined
  let page = 0

  while (true) {
    page += 1
    const response = await listContacts({
      ...params,
      startAfter,
      startAfterId,
    })
    const contacts = response.contacts ?? []
    for (const contact of contacts) {
      yield contact
    }
    if (contacts.length < (params.limit ?? DEFAULT_PAGE_SIZE)) {
      return
    }
    const last = contacts[contacts.length - 1]
    if (!last?.dateAdded || !last?.id) return
    startAfter = new Date(last.dateAdded).getTime()
    startAfterId = last.id
    // Safety net — GHL at 100k contacts would be ~1000 pages, stop at 10k pages.
    if (page > 10000) {
      throw new Error(`listAllContacts safety break at page ${page}`)
    }
  }
}

export async function getContact(contactId: string): Promise<GhlContact> {
  const response = await ghlFetch<{ contact: GhlContact } | GhlContact>(
    `/contacts/${contactId}`,
  )
  if ("contact" in (response as { contact: GhlContact })) {
    return (response as { contact: GhlContact }).contact
  }
  return response as GhlContact
}

export async function createContact(
  input: GhlContactInput,
): Promise<GhlContact> {
  const locationId = input.locationId ?? getGhlConfig().locationId
  const response = await ghlFetch<{ contact: GhlContact } | GhlContact>(
    "/contacts/",
    {
      method: "POST",
      body: { ...input, locationId },
    },
  )
  if ("contact" in (response as { contact: GhlContact })) {
    return (response as { contact: GhlContact }).contact
  }
  return response as GhlContact
}

export async function upsertContact(input: GhlContactInput): Promise<{
  contact: GhlContact
  new: boolean
  traceId?: string
}> {
  const locationId = input.locationId ?? getGhlConfig().locationId
  return ghlFetch<{ contact: GhlContact; new: boolean; traceId?: string }>(
    "/contacts/upsert",
    {
      method: "POST",
      body: { ...input, locationId },
    },
  )
}

export async function updateContact(
  contactId: string,
  input: Partial<GhlContactInput>,
): Promise<GhlContact> {
  const response = await ghlFetch<{ contact: GhlContact } | GhlContact>(
    `/contacts/${contactId}`,
    {
      method: "PUT",
      body: input,
    },
  )
  if ("contact" in (response as { contact: GhlContact })) {
    return (response as { contact: GhlContact }).contact
  }
  return response as GhlContact
}

export async function deleteContact(
  contactId: string,
): Promise<{ succeded: boolean }> {
  return ghlFetch<{ succeded: boolean }>(`/contacts/${contactId}`, {
    method: "DELETE",
  })
}

export async function addContactTags(
  contactId: string,
  tags: string[],
): Promise<{ tags: string[] }> {
  return ghlFetch<{ tags: string[] }>(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: { tags },
  })
}

export async function removeContactTags(
  contactId: string,
  tags: string[],
): Promise<{ tags: string[] }> {
  return ghlFetch<{ tags: string[] }>(`/contacts/${contactId}/tags`, {
    method: "DELETE",
    body: { tags },
  })
}
