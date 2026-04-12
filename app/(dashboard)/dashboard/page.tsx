"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  Package,
  DollarSign,
  Zap,
  Star,
  TrendingUp,
  ShoppingBag,
  ClipboardList,
  Settings,
  ArrowUpRight,
  Eye,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WelcomeHeader } from "@/components/shared/welcome-header"
import { useOrders } from "@/lib/hooks/use-orders"
import type { Order, OrderStatus } from "@/lib/types/order"

const statusBadgeColors: Record<OrderStatus, string> = {
  pending_approval: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  received: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  processing: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  in_transit: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
}

const statusLabels: Record<OrderStatus, string> = {
  pending_approval: "Pending Approval",
  received: "Received",
  processing: "Processing",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Rejected",
}

const quickActions = [
  {
    title: "Browse Products",
    description: "Explore our full catalog of industrial chemicals.",
    icon: ShoppingBag,
    href: "/products",
  },
  {
    title: "View Orders",
    description: "See your complete order history and tracking details.",
    icon: ClipboardList,
    href: "/dashboard/orders",
  },
  {
    title: "Manage Account",
    description: "Update your company profile and delivery preferences.",
    icon: Settings,
    href: "/dashboard/settings",
  },
]

function formatCurrency(value: number) {
  return "AUD " + value.toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20" />
        <Skeleton className="mt-2 h-3 w-32" />
      </CardContent>
    </Card>
  )
}

function RecentOrdersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2 py-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-12 hidden md:block" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data: orders, isLoading } = useOrders()

  const stats = useMemo(() => {
    if (!orders) return null

    const totalOrders = orders.length
    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0)
    const activeOrders = orders.filter(
      (o) =>
        o.status === "received" ||
        o.status === "processing" ||
        o.status === "in_transit"
    ).length

    // Count orders from this month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthOrders = orders.filter(
      (o) => new Date(o.created_at) >= startOfMonth
    ).length

    return [
      {
        title: "Total Orders",
        value: totalOrders.toString(),
        trend: `+${thisMonthOrders} this month`,
        icon: Package,
      },
      {
        title: "Total Spent",
        value: formatCurrency(totalSpent),
        trend: "Lifetime total",
        icon: DollarSign,
      },
      {
        title: "Active Orders",
        value: activeOrders.toString(),
        trend: "Processing and in transit",
        icon: Zap,
      },
      {
        title: "Rewards Points",
        value: Math.floor(totalSpent * 0.05).toLocaleString(),
        trend: "Based on total spend",
        icon: Star,
      },
    ]
  }, [orders])

  const recentOrders = useMemo(() => {
    if (!orders) return []
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5)
  }, [orders])

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <WelcomeHeader />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !stats
          ? Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : stats.map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="mt-1 flex items-center text-xs text-emerald-500">
                      <TrendingUp className="mr-1 h-3 w-3" />
                      {stat.trend}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            Your latest purchases and their current status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <RecentOrdersSkeleton />
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                No orders yet. Browse our catalog to get started.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/products">Browse Products</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order: Order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeColors[order.status]}
                      >
                        {statusLabels[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {order.items.length}{" "}
                      {order.items.length === 1 ? "item" : "items"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      AUD {order.total.toLocaleString("en-AU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/orders">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Card
                key={action.title}
                className="group relative overflow-hidden transition-shadow hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <CardTitle className="mt-2 text-base">
                    {action.title}
                  </CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={action.href}>Go -&gt;</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
