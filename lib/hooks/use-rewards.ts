import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { get, post } from "@/lib/api/client"

export interface CustomerRewards {
  id: string
  user_id: string
  current_tier: string
  current_month_spend: number
  annual_spend: number
  total_stamps: number
  stamps_redeemed: number
  referral_count: number
  first_order_incentive_used: boolean
  first_order_incentive_type: string | null
  created_at: string
  updated_at: string
}

export interface RewardTier {
  id: string
  name: string
  display_name: string
  min_monthly_spend: number
  reward_description: string
  reward_detail: string
  estimated_monthly_savings: number
  sort_order: number
  is_active: boolean
}

export interface Referral {
  id: string
  referrer_id: string
  referrer_name: string
  referred_site_name: string
  referred_contact_name: string
  referred_phone: string
  status: string
  reward_given: boolean
  created_at: string
}

export function useRewards() {
  return useQuery<CustomerRewards | null>({
    queryKey: ["customer-rewards"],
    queryFn: async () => {
      try {
        return await get<CustomerRewards>("/rewards")
      } catch (error) {
        // Return null for unauthenticated users (401) - expected on public pages
        if (error instanceof Error && "status" in error && (error as { status: number }).status === 401) {
          return null
        }
        throw error
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useRewardTiers() {
  return useQuery<RewardTier[]>({
    queryKey: ["reward-tiers"],
    queryFn: () => get<RewardTier[]>("/rewards/tiers"),
    staleTime: 300_000,
  })
}

export function useReferrals() {
  return useQuery<Referral[]>({
    queryKey: ["referrals"],
    queryFn: () => get<Referral[]>("/rewards/referrals"),
    staleTime: 60_000,
  })
}

export function useSubmitReferral() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      referrerName: string
      referredSiteName: string
      contactPerson: string
      phone: string
    }) => post("/rewards/referrals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] })
      queryClient.invalidateQueries({ queryKey: ["customer-rewards"] })
    },
  })
}

export function useBundles() {
  return useQuery<{
    id: string
    name: string
    discount_percent: number
    min_products: number
    badge_text: string | null
    is_active: boolean
    bundle_products: { product_id: string; product: { id: string; name: string; slug: string; price: number; unit: string } | null }[]
  }[]>({
    queryKey: ["public-bundles"],
    queryFn: () => get("/admin/rewards/bundles"),
    staleTime: 300_000,
  })
}

export function usePromotions() {
  return useQuery<{
    id: string
    name: string
    headline: string | null
    description: string | null
    discount_type: string
    discount_value: number
    promotion_type_detail: string | null
    min_order_value: number
    eligible_product_ids: string[] | null
    buy_quantity: number
    start_date: string | null
    end_date: string | null
    is_active: boolean
  }[]>({
    queryKey: ["public-promotions"],
    queryFn: () => get("/admin/rewards/promotions"),
    staleTime: 60_000,
  })
}

export function useEarlyAccessSignup() {
  return useMutation({
    mutationFn: (data: { email: string; productSlug?: string }) =>
      post("/rewards/early-access", data),
  })
}
