"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { get, patch } from "@/lib/api/client"

export interface MarketingSettingsResponse {
  settings: Record<string, string>
  ghl: {
    status: "connected" | "error" | "unknown"
    location?: { id: string; name: string }
  }
}

export function useMarketingSettings() {
  return useQuery({
    queryKey: ["marketing-settings"],
    queryFn: () => get<MarketingSettingsResponse>("/marketing/settings"),
  })
}

export function useUpdateMarketingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: Record<string, string>) =>
      patch<{ ok: true; updated: number }>("/marketing/settings", updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-settings"] })
    },
  })
}
