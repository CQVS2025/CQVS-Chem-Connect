"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, put } from "@/lib/api/client"

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => get<Record<string, string>>("/settings"),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Record<string, string>) =>
      put<{ success: boolean }>("/settings", settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
    },
  })
}
