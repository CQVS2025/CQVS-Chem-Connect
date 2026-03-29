"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, del, postForm } from "@/lib/api/client"

export interface ProductDoc {
  id: string
  file_name: string
  file_size: number
  file_type: string
  doc_type: string
  download_url?: string | null
  view_url?: string | null
}

export function useProductDocuments(productId: string) {
  return useQuery({
    queryKey: ["products", "documents", productId],
    queryFn: () => get<ProductDoc[]>(`/products/${productId}/documents`),
    enabled: !!productId,
  })
}

export function useUploadProductDocuments(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ files, docType = "sds" }: { files: FileList | File[]; docType?: string }) => {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i])
      }
      formData.append("doc_type", docType)
      return postForm(`/products/${productId}/documents`, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "documents", productId] })
    },
  })
}

export function useDeleteProductDocument(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      del(`/products/${productId}/documents`, { document_id: documentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", "documents", productId] })
    },
  })
}
