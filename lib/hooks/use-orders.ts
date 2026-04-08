"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { get, post, patch, del } from "@/lib/api/client"
import type { Order, OrderStatus } from "@/lib/types/order"

// Re-export types for convenience
export type { Order, OrderItem, OrderStatusHistory } from "@/lib/types/order"

interface OrderFilters {
  status?: OrderStatus
}

interface CreateOrderItem {
  product_id: string
  quantity: number
  packaging_size: string
  packaging_size_id?: string | null
  unit_price: number
}

interface CreateOrderInput {
  payment_method: "stripe" | "purchase_order"
  po_number?: string
  invoice_email?: string
  forklift_available?: boolean
  first_order_choice?: string | null
  first_order_truck_wash?: string | null
  items: CreateOrderItem[]
  delivery_address_street: string
  delivery_address_city: string
  delivery_address_state: string
  delivery_address_postcode: string
  delivery_notes?: string
}

interface ConfirmPaymentInput {
  id: string
  payment_intent_id: string
}

interface UpdateOrderStatusInput {
  id: string
  status: OrderStatus
  note?: string
  tracking_number?: string
  estimated_delivery?: string
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => get<Order[]>("/orders"),
    refetchOnWindowFocus: true,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => get<Order>(`/orders/${id}`),
    enabled: !!id,
  })
}

export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateOrderInput) => post<Order>("/orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["cart"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    },
  })
}

export function useConfirmPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payment_intent_id }: ConfirmPaymentInput) =>
      post<Order>(`/orders/${id}/confirm`, { payment_intent_id }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    },
  })
}

export function useAdminOrders(filters: OrderFilters = {}) {
  const params: Record<string, string> = {}
  if (filters.status) params.status = filters.status

  return useQuery({
    queryKey: ["orders", "admin", filters],
    queryFn: () => get<Order[]>("/orders", { params }),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOrderStatusInput) =>
      patch<Order>(`/orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    },
  })
}

export function useDeleteOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    },
  })
}
