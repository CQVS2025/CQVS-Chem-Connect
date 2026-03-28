"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, patch, del } from "@/lib/api/client"

export interface QuoteRequest {
  id: string
  user_id: string
  product_id: string | null
  product_name: string
  quantity: number
  packaging_size: string | null
  delivery_location: string | null
  message: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  company_name: string | null
  status: "pending" | "reviewed" | "responded" | "closed"
  admin_notes: string | null
  created_at: string
  updated_at: string
}

interface CreateQuoteInput {
  product_id?: string
  product_name: string
  quantity: number
  packaging_size?: string
  delivery_location?: string
  message?: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  company_name?: string
}

interface UpdateQuoteInput {
  id: string
  status?: string
  admin_notes?: string
}

export function useQuotes() {
  return useQuery({
    queryKey: ["quotes"],
    queryFn: () => get<QuoteRequest[]>("/quotes"),
  })
}

export function useAdminQuotes(status?: string) {
  return useQuery({
    queryKey: ["admin-quotes", status],
    queryFn: () =>
      get<QuoteRequest[]>(`/quotes${status && status !== "all" ? `?status=${status}` : ""}`),
  })
}

export function useCreateQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateQuoteInput) => post<QuoteRequest>("/quotes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] })
    },
  })
}

export function useUpdateQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateQuoteInput) =>
      patch<QuoteRequest>(`/quotes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] })
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] })
    },
  })
}

export function useDeleteQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] })
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] })
    },
  })
}
