"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post, put, del } from "@/lib/api/client"
import type { Warehouse, ContainerCost, PackagingSize } from "@/lib/supabase/types"

export interface WarehouseInput {
  name: string
  address_street: string
  address_city: string
  address_state: string
  address_postcode: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  xero_contact_id?: string | null
  is_active?: boolean
  is_supplier_managed?: boolean
  sort_order?: number
}

export interface ContainerCostWithRelations extends ContainerCost {
  warehouse?: { id: string; name: string }
  packaging_size?: Pick<PackagingSize, "id" | "name" | "volume_litres">
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: () => get<Warehouse[]>("/warehouses"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: WarehouseInput) => post<Warehouse>("/warehouses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] })
    },
  })
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: WarehouseInput & { id: string }) =>
      put<Warehouse>(`/warehouses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] })
    },
  })
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] })
    },
  })
}

export function useContainerCosts(warehouseId?: string) {
  return useQuery({
    queryKey: ["container-costs", warehouseId ?? "all"],
    queryFn: () =>
      get<ContainerCostWithRelations[]>("/container-costs", {
        params: warehouseId ? { warehouse_id: warehouseId } : {},
      }),
  })
}

export function useUpsertContainerCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      warehouse_id: string
      packaging_size_id: string
      cost: number
    }) => post<ContainerCost>("/container-costs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["container-costs"] })
    },
  })
}

export interface WarehousePricingRow {
  id: string
  warehouse_id: string
  product_id: string
  packaging_size_id: string
  cost_price: number
  warehouse?: { id: string; name: string }
  product?: { id: string; name: string }
  packaging_size?: Pick<PackagingSize, "id" | "name" | "volume_litres">
}

export function useWarehousePricing(filters: {
  warehouseId?: string
  productId?: string
} = {}) {
  return useQuery({
    queryKey: ["warehouse-pricing", filters],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (filters.warehouseId) params.warehouse_id = filters.warehouseId
      if (filters.productId) params.product_id = filters.productId
      return get<WarehousePricingRow[]>("/warehouse-pricing", { params })
    },
  })
}

export function useUpsertWarehousePricing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      warehouse_id: string
      product_id: string
      packaging_size_id: string
      cost_price: number
    }) => post<WarehousePricingRow>("/warehouse-pricing", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-pricing"] })
    },
  })
}

// ============================================================
// Product ↔ Warehouse mapping hooks
// ============================================================

export interface ProductWarehouseMapping {
  id: string
  product_id: string
  warehouse_id: string
  packaging_size_id: string | null
  product?: { id: string; name: string; slug: string }
  warehouse?: { id: string; name: string }
  packaging_size?: { id: string; name: string } | null
}

export function useProductWarehouses(
  filters: { warehouseId?: string; productId?: string } = {},
) {
  return useQuery({
    queryKey: ["product-warehouses", filters],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (filters.warehouseId) params.warehouse_id = filters.warehouseId
      if (filters.productId) params.product_id = filters.productId
      return get<ProductWarehouseMapping[]>("/product-warehouses", { params })
    },
    enabled: Boolean(filters.warehouseId ?? filters.productId),
  })
}

export function useAddProductWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      product_id: string
      warehouse_id: string
      packaging_size_id?: string | null
    }) => post<ProductWarehouseMapping>("/product-warehouses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-warehouses"] })
    },
  })
}

export function useRemoveProductWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      warehouseId,
      packagingSizeId,
    }: {
      productId: string
      warehouseId: string
      packagingSizeId?: string | null
    }) => {
      const params: Record<string, string> = {
        product_id: productId,
        warehouse_id: warehouseId,
      }
      if (packagingSizeId) {
        params.packaging_size_id = packagingSizeId
      }
      return del<void>("/product-warehouses", undefined, { params })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-warehouses"] })
    },
  })
}

// ============================================================
// Products with packaging sizes (for product-warehouse mapping UI)
// ============================================================

export interface ProductWithPackagingSizes {
  id: string
  name: string
  slug: string
  category?: string | null
  packaging_prices: Array<{
    id: string
    packaging_size_id: string
    is_available: boolean
    packaging_size: { id: string; name: string; sort_order: number }
  }>
}

export function useProductsWithPackagingSizes() {
  return useQuery({
    queryKey: ["products", "with-packaging-sizes"],
    queryFn: () =>
      get<ProductWithPackagingSizes[]>("/products", {
        params: { includePricing: "true" },
      }),
  })
}
