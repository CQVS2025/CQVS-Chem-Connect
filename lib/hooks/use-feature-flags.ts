"use client"

import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"

interface FeatureFlags {
  quotes_enabled: boolean
  early_access_limit: number
}

const defaults: FeatureFlags = {
  quotes_enabled: true,
  early_access_limit: 20,
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      try {
        return await get<FeatureFlags>("/settings/public")
      } catch {
        return defaults
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: defaults,
  })
}
