"use client"

import { useMutation } from "@tanstack/react-query"

export function useUploadImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Upload failed")
      }

      return response.json() as Promise<{ url: string }>
    },
  })
}
