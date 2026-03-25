import type { Metadata } from "next"
import Link from "next/link"
import {
  Package,
  DollarSign,
  Star,
  TrendingUp,
  ShoppingBag,
  ClipboardList,
  Settings,
  ArrowUpRight,
  Eye,
  Zap,
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
import { WelcomeHeader } from "@/components/shared/welcome-header"
import { orders, statusColors } from "@/lib/data/orders"

export const metadata: Metadata = {
  title: "Dashboard - Chem Connect",
  description: "View your orders, spending, and rewards.",
}

const stats = [
  {
    title: "Total Orders",
    value: "6",
    trend: "+2 this month",
    icon: Package,
  },
  {
    title: "Total Spent",
    value: "$41,888",
    trend: "+12% from last month",
    icon: DollarSign,
  },
  {
    title: "Active Orders",
    value: "2",
    trend: "Processing & shipped",
    icon: Zap,
  },
  {
    title: "Rewards Points",
    value: "2,450",
    trend: "+180 this month",
    icon: Star,
  },
]

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

export default function DashboardPage() {
  const recentOrders = orders.slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <WelcomeHeader />

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
              {recentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.date).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusColors[order.status]}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {order.items.length}{" "}
                    {order.items.length === 1 ? "item" : "items"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${order.total.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/orders`}>
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
