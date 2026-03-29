"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, patch, del, postForm } from "@/lib/api/client"

export interface ProductImageData {
  id: string
  image_url: string
  is_cover: boolean
  sort_order: number
}

export function useProductImages(productId: string) {
  return useQuery({
    queryKey: ["products", "images", productId],
    queryFn: () => get<ProductImageData[]>(`/products/${productId}/images`),
    enabled: !!productId,
  })
}

export function useUploadProductImages(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ files, isCover = false }: { files: FileList | File[]; isCover?: boolean }) => {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i])
      }
      if (isCover) {
        formData.append("is_cover", "true")
      }
      return postForm(`/products/${productId}/images`, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "images", productId] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export function useSetCoverImage(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: string) =>
      patch(`/products/${productId}/images`, { image_id: imageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "images", productId] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export function useDeleteProductImage(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: string) =>
      del(`/products/${productId}/images`, { image_id: imageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "images", productId] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })
}
