"use client"

import { useQuery } from "@tanstack/react-query"

interface FeatureFlags {
  quotes_enabled: boolean
}

async function fetchFlags(): Promise<FeatureFlags> {
  const res = await fetch("/api/settings/public")
  if (!res.ok) return { quotes_enabled: true }
  return res.json()
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFlags,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: { quotes_enabled: true },
  })
}
