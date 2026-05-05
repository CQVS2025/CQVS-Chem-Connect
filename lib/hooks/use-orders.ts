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
  macship_carrier_id?: string | null
  macship_quote_amount?: number | null
  macship_shipping_breakdown?: Record<string, unknown> | null
  macship_service_name?: string | null
  macship_eta_date?: string | null
  macship_eta_business_days?: number | null
  macship_quote_shape?: "parcel" | "pallet" | null
  macship_is_dg?: boolean | null
  // Feature B — Supplier-managed fulfillment
  site_access_answers?: Record<string, unknown> | null
}

interface FinalizeOrderInput {
  payment_intent_id: string
  checkout_session_id?: string
}

// Shape returned by POST /api/orders for the Stripe path. The order row
// doesn't exist yet - it's created by finalize after the PaymentIntent
// succeeds. PO orders still return a full Order.
export interface StripeCheckoutSession {
  checkout_session_id: string
  payment_intent_id: string
  client_secret: string
  amount_total: number
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

// Creates a PO order (returns the real Order row) OR starts a Stripe
// checkout session (returns a StripeCheckoutSession with a client_secret
// but no order row yet). Callers must discriminate on `payment_method`.
export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateOrderInput) =>
      post<Order | StripeCheckoutSession>("/orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["cart"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    },
  })
}

// Called after stripe.confirmPayment() succeeds on the client. Hits
// /api/orders/finalize which inserts the real order from the stored
// checkout_session and runs MacShip/Xero/email side effects.
export function useFinalizeOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FinalizeOrderInput) =>
      post<{ success: boolean; alreadyFinalized: boolean; order: Order }>(
        "/orders/finalize",
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      queryClient.invalidateQueries({ queryKey: ["cart"] })
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
