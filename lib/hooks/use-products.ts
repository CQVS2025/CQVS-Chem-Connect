"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, put, del } from "@/lib/api/client"
import type { Product, ProductInsert, ProductUpdate } from "@/lib/supabase/types"

interface ProductFilters {
  category?: string
  region?: string
  inStock?: boolean
  search?: string
  sort?: string
}

export function useProducts(filters: ProductFilters = {}) {
  const params: Record<string, string> = {}
  if (filters.category && filters.category !== "All")
    params.category = filters.category
  if (filters.region && filters.region !== "All")
    params.region = filters.region
  if (filters.inStock) params.inStock = "true"
  if (filters.search) params.search = filters.search
  if (filters.sort) params.sort = filters.sort

  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => get<Product[]>("/products", { params }),
  })
}

export function useProduct(slugOrId: string) {
  return useQuery({
    queryKey: ["product", slugOrId],
    queryFn: () => get<Product>(`/products/${slugOrId}`),
    enabled: !!slugOrId,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<ProductInsert, "slug">) =>
      post<Product>("/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) =>
      put<Product>(`/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
