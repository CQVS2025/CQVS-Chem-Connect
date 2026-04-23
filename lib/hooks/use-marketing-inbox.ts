"use client"

import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { get, post } from "@/lib/api/client"
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client"

export interface InboxContactSummary {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  tags: string[]
  is_opted_out: boolean
  ghl_contact_id?: string | null
}

export interface InboxThread {
  id: string
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  last_message_direction: string | null
  contact: InboxContactSummary | InboxContactSummary[] | null
}

export interface InboxMessage {
  id: string
  direction: "inbound" | "outbound"
  body: string
  status: string
  from_number: string | null
  to_number: string | null
  occurred_at: string
}

export function useInboxThreads() {
  return useQuery({
    queryKey: ["marketing-inbox"],
    queryFn: () => get<{ conversations: InboxThread[] }>("/marketing/conversations"),
    refetchOnWindowFocus: true,
  })
}

export function useInboxThread(id: string | undefined) {
  return useQuery({
    queryKey: ["marketing-inbox", id],
    queryFn: () =>
      get<{ conversation: InboxThread; messages: InboxMessage[] }>(
        `/marketing/conversations/${id}`,
      ),
    enabled: !!id,
    refetchOnWindowFocus: true,
  })
}

export function useSendReply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      post<{ ok: true; messageId: string }>(
        `/marketing/conversations/${id}/send`,
        { body },
      ),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["marketing-inbox"] })
      queryClient.invalidateQueries({ queryKey: ["marketing-inbox", vars.id] })
    },
  })
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      post<{ ok: true }>(`/marketing/conversations/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketing-inbox"] }),
  })
}

/**
 * Subscribe to sms_messages + sms_conversations realtime events so new
 * inbound messages and conversation bumps refresh the inbox without a poll.
 */
export function useInboxRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const channel = supabase
      .channel("marketing-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sms_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["marketing-inbox"] })
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sms_conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["marketing-inbox"] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
