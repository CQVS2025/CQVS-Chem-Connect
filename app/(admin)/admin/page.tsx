import type { Metadata } from "next"
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
import { products } from "@/lib/data/products"

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const stats = [
  {
    title: "Total Products",
    value: "12",
    trend: "+2 this month",
    icon: Package,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    title: "Total Users",
    value: "156",
    trend: "+12 this month",
    icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    title: "Active Orders",
    value: "23",
    trend: "+5 from last week",
    icon: ShoppingCart,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    title: "Revenue",
    value: "$284,500",
    trend: "+18% from last month",
    icon: DollarSign,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
]

const recentOrders = [
  {
    customer: "Acme Corp",
    orderNumber: "ORD-2026-012",
    date: "2026-03-22",
    status: "processing" as const,
    total: "$12,450",
  },
  {
    customer: "BioLab Inc",
    orderNumber: "ORD-2026-011",
    date: "2026-03-21",
    status: "shipped" as const,
    total: "$8,200",
  },
  {
    customer: "CleanTech Solutions",
    orderNumber: "ORD-2026-010",
    date: "2026-03-20",
    status: "delivered" as const,
    total: "$3,750",
  },
  {
    customer: "QuarryMax Pty Ltd",
    orderNumber: "ORD-2026-009",
    date: "2026-03-19",
    status: "pending" as const,
    total: "$19,800",
  },
  {
    customer: "Pacific Concrete",
    orderNumber: "ORD-2026-008",
    date: "2026-03-18",
    status: "cancelled" as const,
    total: "$6,100",
  },
]

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-500 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Admin Overview - Chem Connect",
  description: "Admin dashboard overview for Chem Connect marketplace.",
}

const lowStockProducts = products.filter((p) => p.stockQty > 0 && p.stockQty < 100)

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground">
          High-level metrics and quick actions for managing Chem Connect.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
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

      {/* Recent Orders + Low Stock Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              The 5 most recent orders placed on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <TableRow key={order.orderNumber}>
                    <TableCell className="font-medium">
                      {order.customer}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize ${statusColors[order.status] ?? ""}`}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.total}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle>Low Stock Alerts</CardTitle>
            </div>
            <CardDescription>
              Products with stock below 100 units.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All products are well stocked.
              </p>
            ) : (
              <div className="space-y-4">
                {lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.category}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 bg-amber-500/10 text-amber-500 border-amber-500/20"
                    >
                      {product.stockQty} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks.
          </CardDescription>
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
