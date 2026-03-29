"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { get, put } from "@/lib/api/client"
import type { Profile } from "@/lib/supabase/types"

interface UserFilters {
  search?: string
  role?: string
  status?: string
}

export function useAdminUsers(filters: UserFilters = {}) {
  const params: Record<string, string> = {}
  if (filters.search) params.search = filters.search
  if (filters.role && filters.role !== "all") params.role = filters.role
  if (filters.status && filters.status !== "all") params.status = filters.status

  return useQuery({
    queryKey: ["admin-users", filters],
    queryFn: () => get<Profile[]>("/admin/users", { params }),
    placeholderData: keepPreviousData,
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: { role?: string; status?: string; contact_name?: string; company_name?: string; phone?: string }
    }) => put<Profile>(`/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      queryClient.invalidateQueries({ queryKey: ["analytics"] })
    },
  })
}
