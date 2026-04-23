"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { get, post, del } from "@/lib/api/client"

export interface Sequence {
  id: string
  name: string
  status?: string
  locationId?: string
  version?: number
  createdAt?: string
  updatedAt?: string
}

export function useSequences() {
  return useQuery({
    queryKey: ["marketing-sequences"],
    queryFn: () => get<{ workflows: Sequence[] }>("/marketing/sequences"),
  })
}

export function useEnrollContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      workflowId,
      contactId,
    }: {
      workflowId: string
      contactId: string
    }) =>
      post<{ ok: true }>(`/marketing/sequences/${workflowId}/enroll`, {
        contactId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-audit-log"] })
    },
  })
}

export function useUnenrollContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      workflowId,
      contactId,
    }: {
      workflowId: string
      contactId: string
    }) =>
      del<{ ok: true }>(`/marketing/sequences/${workflowId}/enroll`, {
        contactId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-audit-log"] })
    },
  })
}
