"use client"

import { useMutation } from "@tanstack/react-query"
import { postForm } from "@/lib/api/client"

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return postForm<{ url: string }>("/upload", formData)
    },
  })
}
