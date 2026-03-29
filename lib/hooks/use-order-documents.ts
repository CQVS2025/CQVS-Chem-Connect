"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, postForm } from "@/lib/api/client"

export interface OrderDoc {
  id: string
  file_name: string
  file_size: number
  file_type: string
  doc_type: string
  download_url?: string
  signed_url?: string
  view_url?: string
}

export function useOrderDocuments(orderId: string | null) {
  return useQuery({
    queryKey: ["orders", "documents", orderId],
    queryFn: () => get<OrderDoc[]>(`/orders/${orderId}/documents`),
    enabled: !!orderId,
  })
}

export function useUploadOrderDocuments(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (files: FileList | File[]) => {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i])
      }
      return postForm(`/orders/${orderId}/documents`, formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", "documents", orderId] })
    },
  })
}
