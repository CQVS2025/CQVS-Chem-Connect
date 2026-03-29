"use client"

import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"

interface FeatureFlags {
  quotes_enabled: boolean
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      try {
        return await get<FeatureFlags>("/settings/public")
      } catch {
        return { quotes_enabled: true }
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: { quotes_enabled: true },
  })
}
