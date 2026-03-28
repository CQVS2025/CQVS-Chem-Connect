"use client"

import Link from "next/link"
import {
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Plus,
  ClipboardList,
  FileText,
} from "lucide-react"

import { useAnalytics } from "@/lib/hooks/use-analytics"
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
import { PageTransition } from "@/components/shared/page-transition"

const statusColors: Record<string, string> = {
  received: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  processing: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  in_transit: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  delivered: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useAnalytics()

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <div>
            <Skeleton className="h-9 w-52" />
            <Skeleton className="mt-2 h-5 w-80" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </PageTransition>
    )
  }

  const stats = data?.stats
  const recentOrders = data?.recentOrders ?? []
  const lowStock = data?.lowStockProducts ?? []

  const statCards = [
    {
      title: "Total Products",
      value: stats?.totalProducts ?? 0,
      trend: `${stats?.pendingQuotes ?? 0} pending quotes`,
      icon: Package,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      title: "Total Users",
      value: stats?.totalUsers ?? 0,
      trend: `+${stats?.newUsersThisMonth ?? 0} this month`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Active Orders",
      value: stats?.activeOrders ?? 0,
      trend: `${stats?.ordersThisMonth ?? 0} orders this month`,
      icon: ShoppingCart,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Revenue",
      value: formatCurrency(stats?.totalRevenue ?? 0),
      trend: `${formatCurrency(stats?.revenueThisMonth ?? 0)} this month`,
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ]

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-muted-foreground">
            High-level metrics and quick actions for managing Chem Connect.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${stat.bg}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
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

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest orders on the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No orders yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.customer}</TableCell>
                        <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[order.status] ?? ""}>
                            {formatStatus(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(order.total).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle>Low Stock Alerts</CardTitle>
              </div>
              <CardDescription>Products with stock below 100 units.</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">All products are well stocked.</p>
              ) : (
                <div className="space-y-4">
                  {lowStock.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-amber-500/10 text-amber-500 border-amber-500/20">
                        {p.stockQty} left
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/products">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/orders">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  View All Orders
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/quotes">
                  <FileText className="mr-2 h-4 w-4" />
                  Quote Requests
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
