"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, put } from "@/lib/api/client"
import type { Profile, ProfileUpdate } from "@/lib/supabase/types"

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => get<Profile>("/profile"),
    retry: false,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProfileUpdate) => put<Profile>("/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
    },
  })
}
