"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, patch, del } from "@/lib/api/client"
import type { ProductPriceType } from "@/lib/supabase/types"

export interface CartPackagingPrice {
  id: string
  packaging_size_id: string
  price_per_litre: number | null
  fixed_price: number | null
  packaging_size: {
    id: string
    name: string
    volume_litres: number | null
  }
}

export interface CartItemProduct {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  image_url: string | null
  in_stock: boolean
  stock_qty: number
  shipping_fee: number
  price_type: ProductPriceType
  packaging_prices?: CartPackagingPrice[]
}

export interface CartItem {
  id: string
  product_id: string
  quantity: number
  packaging_size: string
  packaging_size_id: string | null
  created_at: string
  product: CartItemProduct
}

interface AddToCartInput {
  product_id: string
  quantity: number
  packaging_size: string
  packaging_size_id?: string
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
    refetchOnWindowFocus: true,
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
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] })
      const previous = queryClient.getQueryData<CartItem[]>(["cart"])
      queryClient.setQueryData<CartItem[]>(["cart"], (old) =>
        old?.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart"], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/cart/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] })
      const previous = queryClient.getQueryData<CartItem[]>(["cart"])
      queryClient.setQueryData<CartItem[]>(["cart"], (old) =>
        old?.filter((item) => item.id !== id)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart"], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] })
    },
  })
}
