"use client"

import { useEffect, useState } from "react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { del, get, patch, post } from "@/lib/api/client"
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client"

export type MarketingContactSource =
  | "ghl_initial_sync"
  | "ghl_webhook"
  | "csv_import"
  | "manual"
  | "sms_auto_create"

export interface MarketingContact {
  id: string
  ghl_contact_id: string | null
  email: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  company_name: string | null
  state: string | null
  country: string | null
  tags: string[]
  custom_fields: Record<string, unknown>
  is_opted_out: boolean
  opted_out_at: string | null
  source: MarketingContactSource
  profile_id: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface MarketingEvent {
  id: string
  event_type: string
  campaign_id: string | null
  metadata: Record<string, unknown>
  occurred_at: string
}

export interface ContactListResponse {
  contacts: MarketingContact[]
  total: number
  page: number
  limit: number
}

export interface ContactProfileResponse {
  contact: MarketingContact
  events: MarketingEvent[]
  eventsPagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  conversation: {
    id: string
    unread_count: number
    last_message_at: string | null
    last_message_preview: string | null
    last_message_direction: string | null
  } | null
}

interface ListParams {
  q?: string
  /** Legacy single tag. Prefer `tags` for new code. */
  tag?: string
  /** Multiple tags; semantics controlled by `tagMatchAll`. */
  tags?: string[]
  /** When true (default), contact must have ALL tags. When false, any. */
  tagMatchAll?: boolean
  state?: string
  page?: number
  limit?: number
}

export function useMarketingContacts(params: ListParams = {}) {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.tag) search.set("tag", params.tag)
  if (params.tags && params.tags.length > 0) {
    search.set("tags", params.tags.join(","))
  }
  if (params.tagMatchAll === false) search.set("tagMatchAll", "false")
  if (params.state) search.set("state", params.state)
  if (params.page) search.set("page", String(params.page))
  if (params.limit) search.set("limit", String(params.limit))
  const qs = search.toString()

  return useQuery({
    queryKey: ["marketing-contacts", params],
    queryFn: () =>
      get<ContactListResponse>(
        `/marketing/contacts${qs ? `?${qs}` : ""}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useMarketingContact(
  id: string | undefined,
  opts: { eventsPage?: number; eventsSize?: number } = {},
) {
  const search = new URLSearchParams()
  if (opts.eventsPage) search.set("eventsPage", String(opts.eventsPage))
  if (opts.eventsSize) search.set("eventsSize", String(opts.eventsSize))
  const qs = search.toString()

  return useQuery({
    queryKey: ["marketing-contact", id, opts.eventsPage ?? 1, opts.eventsSize ?? 20],
    queryFn: () =>
      get<ContactProfileResponse>(
        `/marketing/contacts/${id}${qs ? `?${qs}` : ""}`,
      ),
    enabled: !!id,
    placeholderData: keepPreviousData,
  })
}

export interface CreateContactInput {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  company_name?: string
  state?: string
  tags?: string[]
}

export function useCreateMarketingContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateContactInput) =>
      post<{ contactId: string; ghlContactId: string }>(
        "/marketing/contacts",
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-contact-tags"] })
    },
  })
}

export function useUpdateMarketingContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & CreateContactInput) =>
      patch<{ ok: true }>(`/marketing/contacts/${id}`, input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-contact-tags"] })
      queryClient.invalidateQueries({
        queryKey: ["marketing-contact", vars.id],
      })
    },
  })
}

export function useDeleteMarketingContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<{ ok: true }>(`/marketing/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-contact-tags"] })
    },
  })
}

export interface ImportRow {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company_name?: string
  state?: string
  tags?: string[]
}

export interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  results: Array<{
    index: number
    status: "created" | "updated" | "skipped" | "failed"
    reason?: string
    ghlContactId?: string
  }>
}

export function useImportMarketingContacts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { rows: ImportRow[]; default_tags?: string[] }) =>
      post<ImportResult>("/marketing/contacts/import", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-contact-tags"] })
    },
  })
}

/**
 * Subscribe to `marketing_contacts` Realtime changes and invalidate the
 * contacts list + any open contact-detail query when a row changes.
 * Mount this once on the contacts list page (and optionally on the
 * contact-detail page) so webhook-driven updates appear live.
 */
export function useContactsRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const channel = supabase
      .channel("marketing-contacts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "marketing_contacts" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] })
          // Also bust the specific contact-detail query if we have the id.
          const row =
            (payload.new as { id?: string } | null) ??
            (payload.old as { id?: string } | null)
          if (row?.id) {
            queryClient.invalidateQueries({
              queryKey: ["marketing-contact", row.id],
            })
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

/**
 * Returns every distinct tag currently applied to non-deleted contacts,
 * with the number of contacts carrying each tag. Powers the campaign-
 * builder tag picker. Cached for 5 minutes — tags change infrequently.
 */
export function useMarketingContactTags() {
  return useQuery({
    queryKey: ["marketing-contact-tags"],
    queryFn: () =>
      get<{ tags: Array<{ tag: string; count: number }> }>(
        "/marketing/contacts/tags",
      ),
    staleTime: 5 * 60_000,
  })
}

// Sync runs in chunks on Vercel Hobby (10s cap per request), so the hook
// loops client-side, posting a cursor to /sync until `done: true`.
// Exposes `progress` so the UI can show "Synced 240/340" mid-run.
export interface SyncTotals {
  total: number
  created: number
  updated: number
  failed: number
}

interface SyncChunkResponse {
  done: boolean
  startAfter?: number
  startAfterId?: string
  totals: SyncTotals
  ghlTotal?: number
  chunkDurationMs: number
}

export interface SyncProgress {
  totals: SyncTotals
  // GHL's meta.total from the first chunk response. Null until the first
  // request returns. Lets the UI show "240/340" instead of just "240".
  ghlTotal: number | null
}

export function useForceSyncMarketingContacts() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  const mutation = useMutation({
    mutationFn: async (): Promise<SyncTotals> => {
      const initialTotals: SyncTotals = {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
      }
      setProgress({ totals: initialTotals, ghlTotal: null })
      const sessionStartedAt = Date.now()
      let startAfter: number | undefined
      let startAfterId: string | undefined
      let totals: SyncTotals = initialTotals
      let ghlTotal: number | null = null

      // Safety cap on chunk count - 100 chunks * 100 contacts/page = 10k contacts.
      // Well beyond current usage; protects against runaway loops if GHL's
      // cursor ever misbehaves.
      for (let i = 0; i < 100; i++) {
        const res = await post<SyncChunkResponse>(
          "/marketing/contacts/sync",
          {
            startAfter,
            startAfterId,
            totals,
            session_started_at: sessionStartedAt,
          },
        )
        totals = res.totals
        // Capture GHL's total from the first response that reports one.
        if (ghlTotal === null && typeof res.ghlTotal === "number") {
          ghlTotal = res.ghlTotal
        }
        setProgress({ totals, ghlTotal })
        if (res.done) return totals
        startAfter = res.startAfter
        startAfterId = res.startAfterId
        if (startAfter === undefined || !startAfterId) return totals
      }
      throw new Error("Sync exceeded chunk limit — aborting to avoid runaway loop")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-contacts"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-contact-tags"] })
    },
    onSettled: () => {
      // Clear progress a moment after completion so the button returns to
      // its resting state.
      setTimeout(() => setProgress(null), 1500)
    },
  })

  return Object.assign(mutation, { progress })
}
