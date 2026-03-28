"use client"

import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"

export interface AnalyticsData {
  stats: {
    totalProducts: number
    totalUsers: number
    activeOrders: number
    totalRevenue: number
    revenueThisMonth: number
    ordersThisMonth: number
    totalOrders: number
    avgOrderValue: number
    newUsersThisMonth: number
    pendingQuotes: number
  }
  monthlyData: {
    month: string
    fullMonth: string
    revenue: number
    orders: number
  }[]
  statusCounts: Record<string, number>
  topProducts: { name: string; qty: number; revenue: number }[]
  paymentMethods: Record<string, number>
  lowStockProducts: { id: string; name: string; category: string; stockQty: number }[]
  recentOrders: {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string
    total: number
    createdAt: string
    userId: string
    customer: string
  }[]
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => get<AnalyticsData>("/analytics"),
    staleTime: 60 * 1000,
  })
}
