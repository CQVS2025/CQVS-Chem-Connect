"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, patch, del } from "@/lib/api/client"

export interface CartItemProduct {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  image_url: string | null
  in_stock: boolean
  stock_qty: number
}

export interface CartItem {
  id: string
  product_id: string
  quantity: number
  packaging_size: string
  created_at: string
  product: CartItemProduct
}

interface AddToCartInput {
  product_id: string
  quantity: number
  packaging_size: string
}

interface UpdateCartItemInput {
  id: string
  quantity: number
}

export function useCart() {
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => get<CartItem[]>("/cart"),
    staleTime: 30 * 1000,
  })
}

export function useAddToCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AddToCartInput) => post<CartItem>("/cart", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quantity }: UpdateCartItemInput) =>
      patch<CartItem>(`/cart/${id}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/cart/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}
