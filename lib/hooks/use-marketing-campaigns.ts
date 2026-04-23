"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { del, get, patch, post } from "@/lib/api/client"

export type CampaignType = "email" | "sms"
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled"

export interface MarketingCampaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  audience_filter: Record<string, unknown>
  audience_count: number
  subject: string | null
  preheader: string | null
  body_html: string | null
  body_text: string | null
  from_email: string | null
  from_name: string | null
  reply_to: string | null
  scheduled_at: string | null
  sent_at: string | null
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
  unsubscribed_count: number
  failed_count: number
  created_at: string
  updated_at: string
}

export interface CampaignListResponse {
  campaigns: MarketingCampaign[]
  total: number
  page: number
  limit: number
}

interface ListParams {
  status?: CampaignStatus
  type?: CampaignType
  page?: number
  limit?: number
}

export function useMarketingCampaigns(params: ListParams = {}) {
  const search = new URLSearchParams()
  if (params.status) search.set("status", params.status)
  if (params.type) search.set("type", params.type)
  if (params.page) search.set("page", String(params.page))
  if (params.limit) search.set("limit", String(params.limit))
  const qs = search.toString()
  return useQuery({
    queryKey: ["marketing-campaigns", params],
    queryFn: () =>
      get<CampaignListResponse>(
        `/marketing/campaigns${qs ? `?${qs}` : ""}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export interface CampaignDetailResponse {
  campaign: MarketingCampaign
  events: Array<{
    id: string
    event_type: string
    contact_id: string | null
    ghl_contact_id: string | null
    metadata: Record<string, unknown>
    occurred_at: string
  }>
}

export function useMarketingCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ["marketing-campaign", id],
    queryFn: () => get<CampaignDetailResponse>(`/marketing/campaigns/${id}`),
    enabled: !!id,
  })
}

export interface CreateCampaignInput {
  name: string
  type: CampaignType
  audience_filter?: Record<string, unknown>
  subject?: string
  preheader?: string
  body_html?: string
  body_text?: string
  from_email?: string
  from_name?: string
  reply_to?: string
  scheduled_at?: string
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      post<{ id: string }>("/marketing/campaigns", input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<CreateCampaignInput>) =>
      patch<{ ok: true }>(`/marketing/campaigns/${id}`, input),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-campaign", vars.id] })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<{ ok: true }>(`/marketing/campaigns/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] }),
  })
}

export interface SendCampaignResult {
  campaignId: string
  audienceCount: number
  succeeded: number
  failed: number
  skipped: number
  errors?: Array<{ contactId: string; error: string }>
}

export function useSendCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      post<SendCampaignResult>(`/marketing/campaigns/${id}/send`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-campaign", id] })
    },
  })
}

export function useCancelCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      post<{ ok: true }>(`/marketing/campaigns/${id}/cancel`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-campaign", id] })
    },
  })
}

export function useTestSendCampaign() {
  return useMutation({
    mutationFn: ({ id, contactId }: { id: string; contactId: string }) =>
      post<{ ok: true; messageId: string }>(
        `/marketing/campaigns/${id}/test-send`,
        { contactId },
      ),
  })
}

export function useCampaignPreview() {
  return useMutation({
    mutationFn: (id: string) =>
      post<{ campaign: MarketingCampaign; audienceCount: number }>(
        `/marketing/campaigns/${id}/preview`,
      ),
  })
}

export type RecipientStatus =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "unsubscribed"
  | "failed"
  | "unknown"

export interface CampaignRecipient {
  contact_id: string
  ghl_contact_id: string | null
  full_name: string | null
  email: string | null
  status: RecipientStatus
  last_activity_at: string | null
  delivered_at: string | null
  opened_at: string | null
  clicked_at: string | null
  last_click_url: string | null
}

export interface CampaignAnalyticsResponse {
  campaign: Pick<
    MarketingCampaign,
    | "id"
    | "name"
    | "type"
    | "status"
    | "audience_count"
    | "subject"
    | "preheader"
    | "sent_at"
    | "scheduled_at"
    | "created_at"
  >
  metrics: {
    audience: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    unsubscribed: number
    failed: number
  }
  recipients: {
    rows: CampaignRecipient[]
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export function useCampaignAnalytics(
  id: string | undefined,
  opts: { page?: number; size?: number; status?: string; q?: string } = {},
) {
  const search = new URLSearchParams()
  if (opts.page) search.set("page", String(opts.page))
  if (opts.size) search.set("size", String(opts.size))
  if (opts.status) search.set("status", opts.status)
  if (opts.q) search.set("q", opts.q)
  const qs = search.toString()

  return useQuery({
    queryKey: [
      "marketing-campaign-analytics",
      id,
      opts.page ?? 1,
      opts.size ?? 25,
      opts.status ?? "",
      opts.q ?? "",
    ],
    queryFn: () =>
      get<CampaignAnalyticsResponse>(
        `/marketing/campaigns/${id}/analytics${qs ? `?${qs}` : ""}`,
      ),
    enabled: !!id,
    placeholderData: keepPreviousData,
  })
}
