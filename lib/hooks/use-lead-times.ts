"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, del } from "@/lib/api/client"

// ============================================================
// Types
// ============================================================

export interface GlobalLeadTime {
  id: string
  manufacturing_days: number
  buffer_days: number
  use_business_days: boolean
  updated_at: string
}

export interface WarehouseLeadTime {
  id: string
  warehouse_id: string
  manufacturing_days: number
  buffer_days: number
  use_business_days: boolean
  notes: string | null
  created_at: string
  updated_at: string
  warehouse?: { id: string; name: string }
}

export interface ProductWarehouseLeadTime {
  id: string
  product_id: string
  warehouse_id: string
  manufacturing_days: number
  buffer_days: number
  use_business_days: boolean
  notes: string | null
  created_at: string
  updated_at: string
  warehouse?: { id: string; name: string }
  product?: { id: string; name: string; slug: string }
}

export interface LeadTimesResponse {
  global: GlobalLeadTime | null
  warehouses: WarehouseLeadTime[]
  productWarehouse: ProductWarehouseLeadTime[]
}

// ============================================================
// Hooks
// ============================================================

/**
 * Fetch all lead time configuration.
 * Optionally filtered by warehouseId and/or productId.
 */
export function useLeadTimes(
  filters: { warehouseId?: string; productId?: string } = {},
) {
  return useQuery({
    queryKey: ["lead-times", filters],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (filters.warehouseId) params.warehouse_id = filters.warehouseId
      if (filters.productId) params.product_id = filters.productId
      return get<LeadTimesResponse>("/lead-times", { params })
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Upsert the global lead time default.
 */
export function useUpsertGlobalLeadTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      manufacturing_days: number
      buffer_days?: number
      use_business_days?: boolean
    }) => post<GlobalLeadTime>("/lead-times/global", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-times"] })
    },
  })
}

/**
 * Upsert a warehouse-level lead time default.
 */
export function useUpsertWarehouseLeadTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      warehouse_id: string
      manufacturing_days: number
      buffer_days?: number
      use_business_days?: boolean
      notes?: string | null
    }) => post<WarehouseLeadTime>("/lead-times/warehouse", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-times"] })
    },
  })
}

/**
 * Upsert a product+warehouse lead time override.
 */
export function useUpsertProductWarehouseLeadTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      product_id: string
      warehouse_id: string
      manufacturing_days: number
      buffer_days?: number
      use_business_days?: boolean
      notes?: string | null
    }) => post<ProductWarehouseLeadTime>("/lead-times/product-warehouse", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-times"] })
    },
  })
}

/**
 * Delete a product+warehouse lead time override.
 */
export function useDeleteProductWarehouseLeadTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      warehouseId,
    }: {
      productId: string
      warehouseId: string
    }) =>
      del<void>("/lead-times/product-warehouse", undefined, {
        params: { product_id: productId, warehouse_id: warehouseId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-times"] })
    },
  })
}
