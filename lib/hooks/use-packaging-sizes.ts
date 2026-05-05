"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, put, del } from "@/lib/api/client"
import type { PackagingSize } from "@/lib/supabase/types"

export function usePackagingSizes() {
  return useQuery({
    queryKey: ["packaging-sizes"],
    queryFn: () => get<PackagingSize[]>("/packaging-sizes"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/** Admin variant — includes inactive sizes so deactivated entries are visible. */
export function useAllPackagingSizes() {
  return useQuery({
    queryKey: ["packaging-sizes", "all"],
    queryFn: () => get<PackagingSize[]>("/packaging-sizes?include_inactive=true"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePackagingSize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      volume_litres?: number | null
      container_type?: string
      sort_order?: number
      is_active?: boolean
      is_visible_on_storefront?: boolean
      units_per_pallet?: number | null
      unit_weight_kg?: number | null
    }) => post<PackagingSize>("/packaging-sizes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-sizes"] })
    },
  })
}

export function useUpdatePackagingSize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
      name?: string
      volume_litres?: number | null
      container_type?: string
      sort_order?: number
      is_active?: boolean
      is_visible_on_storefront?: boolean
      units_per_pallet?: number | null
      unit_weight_kg?: number | null
    }) => put<PackagingSize>(`/packaging-sizes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-sizes"] })
    },
  })
}

export function useDeletePackagingSize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/packaging-sizes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-sizes"] })
    },
  })
}
