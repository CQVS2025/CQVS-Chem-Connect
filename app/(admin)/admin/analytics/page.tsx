import type { Metadata } from "next"
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Analytics - Chem Connect Admin",
  description: "Analytics overview for Chem Connect marketplace.",
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                         */
/* ------------------------------------------------------------------ */

const topProducts = [
  { name: "Green Acid Replacement", sales: 342, revenue: "$83,790" },
  { name: "AdBlue (DEF)", sales: 298, revenue: "$34,270" },
  { name: "Truck Wash Premium", sales: 251, revenue: "$48,945" },
  { name: "Eco Wash", sales: 214, revenue: "$38,520" },
  { name: "Agi Acid", sales: 187, revenue: "$38,522" },
]

const monthlyTrends = [
  {
    month: "January 2026",
    revenue: "$78,200",
    orders: 42,
    trend: "up" as const,
    change: "+12%",
  },
  {
    month: "February 2026",
    revenue: "$92,800",
    orders: 56,
    trend: "up" as const,
    change: "+18.7%",
  },
  {
    month: "March 2026",
    revenue: "$113,500",
    orders: 67,
    trend: "up" as const,
    change: "+22.3%",
  },
]

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Platform performance and key business metrics.
        </p>
      </div>

      {/* Primary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$284,500</div>
            <p className="mt-1 flex items-center text-xs text-emerald-500">
              <TrendingUp className="mr-1 h-3 w-3" />
              +18% from last quarter
            </p>
          </CardContent>
        </Card>

        {/* Orders this month */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders This Month
            </CardTitle>
            <div className="rounded-lg bg-blue-500/10 p-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">23</div>
            <p className="mt-1 flex items-center text-xs text-emerald-500">
              <TrendingUp className="mr-1 h-3 w-3" />
              +5 from last month
            </p>
          </CardContent>
        </Card>

        {/* Average order value */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Order Value
            </CardTitle>
            <div className="rounded-lg bg-violet-500/10 p-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">$12,370</div>
            <p className="mt-1 flex items-center text-xs text-emerald-500">
              <TrendingUp className="mr-1 h-3 w-3" />
              +8.2% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Customer Acquisition */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Products */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>
              Best-performing products by sales count this quarter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.sales} units sold
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {product.revenue}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Customer Acquisition */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Customer Acquisition</CardTitle>
            </div>
            <CardDescription>New customers this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold">18</div>
              <p className="mt-1 text-sm text-muted-foreground">
                new customers in March
              </p>
              <div className="mt-4 flex items-center justify-center gap-1 text-sm text-emerald-500">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+28.6% vs February</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total customers</span>
                <span className="font-medium">156</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active this month</span>
                <span className="font-medium">89</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Retention rate</span>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  94.2%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
          <CardDescription>
            Revenue and order trends over the last 3 months.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {monthlyTrends.map((month) => (
              <div
                key={month.month}
                className="rounded-lg border p-4"
              >
                <p className="text-sm font-medium text-muted-foreground">
                  {month.month}
                </p>
                <div className="mt-2 text-2xl font-bold">{month.revenue}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {month.orders} orders
                  </span>
                  <span
                    className={`flex items-center text-xs font-medium ${
                      month.trend === "up"
                        ? "text-emerald-500"
                        : "text-red-500"
                    }`}
                  >
                    {month.trend === "up" ? (
                      <TrendingUp className="mr-0.5 h-3 w-3" />
                    ) : (
                      <TrendingDown className="mr-0.5 h-3 w-3" />
                    )}
                    {month.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
