"use client"

import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
  BarChart3,
  FileText,
  Gift,
  Crown,
  Award,
  Medal,
  Megaphone,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts"

import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"
import { useAnalytics } from "@/lib/hooks/use-analytics"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageTransition } from "@/components/shared/page-transition"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

function formatCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`
  return `$${amount.toFixed(2)}`
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const revenueChartConfig = {
  revenue: { label: "Revenue", color: "hsl(142 76% 56%)" },
} satisfies ChartConfig

const ordersChartConfig = {
  orders: { label: "Orders", color: "hsl(208 60% 60%)" },
} satisfies ChartConfig

const statusColors: Record<string, string> = {
  received: "hsl(217 91% 60%)",
  processing: "hsl(38 92% 50%)",
  in_transit: "hsl(263 70% 60%)",
  delivered: "hsl(160 84% 39%)",
  cancelled: "hsl(0 84% 60%)",
}

const paymentColors: Record<string, string> = {
  stripe: "hsl(263 70% 60%)",
  purchase_order: "hsl(142 76% 56%)",
}

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useAnalytics()

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <div>
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-2 h-5 w-72" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </PageTransition>
    )
  }

  const stats = data?.stats
  const monthlyData = data?.monthlyData ?? []
  const statusCounts = data?.statusCounts ?? {}
  const topProducts = data?.topProducts ?? []
  const paymentMethods = data?.paymentMethods ?? {}

  const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
    status: formatStatus(status),
    count,
    fill: statusColors[status] || "hsl(210 15% 58%)",
  }))

  const statusChartConfig = Object.fromEntries(
    statusChartData.map((d) => [d.status, { label: d.status, color: d.fill }]),
  ) satisfies ChartConfig

  const paymentChartData = Object.entries(paymentMethods).map(([method, count]) => ({
    method: method === "stripe" ? "Card (Stripe)" : "Purchase Order",
    count,
    fill: paymentColors[method] || "hsl(210 15% 58%)",
  }))

  const paymentChartConfig = Object.fromEntries(
    paymentChartData.map((d) => [d.method, { label: d.method, color: d.fill }]),
  ) satisfies ChartConfig

  // Rewards data
  const { data: customerRewards } = useQuery<
    {
      user_id: string
      current_tier: string
      current_month_spend: number
      annual_spend: number
      total_stamps: number
      referral_count: number
      contact_name: string
      company_name: string
    }[]
  >({
    queryKey: ["admin-customer-rewards-analytics"],
    queryFn: () => get("/admin/rewards/customers"),
  })

  const { data: referrals } = useQuery<{ status: string }[]>({
    queryKey: ["admin-referrals-analytics"],
    queryFn: () => get("/admin/rewards/referrals"),
  })

  const tierCounts = {
    gold: customerRewards?.filter((c) => c.current_tier === "gold").length ?? 0,
    silver: customerRewards?.filter((c) => c.current_tier === "silver").length ?? 0,
    bronze: customerRewards?.filter((c) => c.current_tier === "bronze").length ?? 0,
    none: customerRewards?.filter((c) => c.current_tier === "none").length ?? 0,
  }
  const totalReferrals = referrals?.length ?? 0
  const convertedReferrals = referrals?.filter((r) => r.status === "converted").length ?? 0
  const tierIcons = { gold: Crown, silver: Award, bronze: Medal }
  const tierTextColors = {
    gold: "text-yellow-400",
    silver: "text-slate-300",
    bronze: "text-amber-600",
  }
  const tierBgColors = {
    gold: "bg-yellow-400/10",
    silver: "bg-slate-300/10",
    bronze: "bg-amber-500/10",
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Platform performance and key business metrics.
          </p>
        </div>

        {/* Primary metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats?.totalRevenue ?? 0)}</div>
              <p className="mt-1 flex items-center text-xs text-emerald-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                {formatCurrency(stats?.revenueThisMonth ?? 0)} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalOrders ?? 0}</div>
              <p className="mt-1 flex items-center text-xs text-emerald-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                {stats?.ordersThisMonth ?? 0} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
              <div className="rounded-lg bg-violet-500/10 p-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats?.avgOrderValue ?? 0)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                across {stats?.totalOrders ?? 0} orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <Users className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalUsers ?? 0}</div>
              <p className="mt-1 flex items-center text-xs text-emerald-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                +{stats?.newUsersThisMonth ?? 0} this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart + Orders Chart */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue Bar Chart - with colored bars and labels */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
              <CardDescription>Revenue over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No revenue data yet.</p>
              ) : (
                <ChartContainer config={revenueChartConfig}>
                  <BarChart accessibilityLayer data={monthlyData}>
                    <CartesianGrid vertical={false} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel hideIndicator />}
                    />
                    <Bar dataKey="revenue">
                      <LabelList position="top" dataKey="month" fillOpacity={1} />
                      {monthlyData.map((item) => (
                        <Cell
                          key={item.month}
                          fill={item.revenue > 0 ? "var(--chart-1)" : "var(--chart-2)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
            {monthlyData.length > 0 && (
              <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 leading-none font-medium">
                  {formatCurrency(stats?.revenueThisMonth ?? 0)} this month
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                  Showing revenue for the last 6 months
                </div>
              </CardFooter>
            )}
          </Card>

          {/* Orders Line Chart - linear style */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Orders</CardTitle>
              <CardDescription>Order volume over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No order data yet.</p>
              ) : (
                <ChartContainer config={ordersChartConfig}>
                  <LineChart
                    accessibilityLayer
                    data={monthlyData}
                    margin={{ left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => value.slice(0, 3)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Line
                      dataKey="orders"
                      type="linear"
                      stroke="var(--color-orders)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
            {monthlyData.length > 0 && (
              <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 leading-none font-medium">
                  {stats?.ordersThisMonth ?? 0} orders this month
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                  Showing order volume for the last 6 months
                </div>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Order Status Distribution + Payment Methods */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Order Status Donut Chart with Center Text */}
          <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
              <CardTitle>Order Status Distribution</CardTitle>
              <CardDescription>Breakdown of orders by current status</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {statusChartData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <ChartContainer
                  config={{
                    count: { label: "Orders" },
                    ...statusChartConfig,
                  }}
                  className="mx-auto aspect-square max-h-[250px]"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={statusChartData}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={60}
                      strokeWidth={5}
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                            return (
                              <text
                                x={viewBox.cx}
                                y={viewBox.cy}
                                textAnchor="middle"
                                dominantBaseline="middle"
                              >
                                <tspan
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  className="fill-foreground text-3xl font-bold"
                                >
                                  {(stats?.totalOrders ?? 0).toLocaleString()}
                                </tspan>
                                <tspan
                                  x={viewBox.cx}
                                  y={(viewBox.cy || 0) + 24}
                                  className="fill-muted-foreground"
                                >
                                  Orders
                                </tspan>
                              </text>
                            )
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
            {statusChartData.length > 0 && (
              <CardFooter className="flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 leading-none font-medium">
                  {stats?.activeOrders ?? 0} active orders right now
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                  Showing distribution across all statuses
                </div>
              </CardFooter>
            )}
          </Card>

          {/* Payment Methods Pie Chart - with labels */}
          <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>How customers pay for orders</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
              {paymentChartData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <ChartContainer
                  config={{
                    count: { label: "Orders" },
                    ...paymentChartConfig,
                  }}
                  className="mx-auto aspect-square max-h-[250px] pb-0 [&_.recharts-pie-label-text]:fill-foreground"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie data={paymentChartData} dataKey="count" label nameKey="method" />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
            {paymentChartData.length > 0 && (
              <CardFooter className="flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 leading-none font-medium">
                  {stats?.totalOrders ?? 0} total orders processed
                </div>
                <div className="leading-none text-muted-foreground">
                  Showing payment method breakdown
                </div>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Top Products + Quote Requests */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
              <CardDescription>Best-performing products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No sales data yet. Products will appear here once orders are placed.
                </p>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((product, index) => {
                    const maxRevenue = topProducts[0]?.revenue || 1
                    const percentage = (product.revenue / maxRevenue) * 100
                    return (
                      <div key={product.name}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.qty} units sold</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-primary">
                            ${product.revenue.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Platform Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total customers</span>
                  <span className="font-medium">{stats?.totalUsers ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New this month</span>
                  <span className="font-medium">{stats?.newUsersThisMonth ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total products</span>
                  <span className="font-medium">{stats?.totalProducts ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Active orders</span>
                  <span className="font-medium">{stats?.activeOrders ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending quotes</span>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                    {stats?.pendingQuotes ?? 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg order value</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(stats?.avgOrderValue ?? 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Rewards & Loyalty Insights */}
        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">
            Rewards & Loyalty Insights
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Tier Distribution */}
            {(["gold", "silver", "bronze"] as const).map((tier) => {
              const TierIcon = tierIcons[tier]
              return (
                <Card key={tier}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-xl ${tierBgColors[tier]}`}>
                        <TierIcon className={`size-5 ${tierTextColors[tier]}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{tierCounts[tier]}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {tier} members
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Referrals */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-violet-400/10">
                    <Megaphone className="size-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {convertedReferrals}/{totalReferrals}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Referrals converted
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rewards Overview & Top Spenders */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Rewards Overview</CardTitle>
              </div>
              <CardDescription>Loyalty program metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total customers with tier</span>
                  <span className="font-medium">{tierCounts.gold + tierCounts.silver + tierCounts.bronze}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Customers without tier</span>
                  <span className="font-medium">{tierCounts.none}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Referral conversion rate</span>
                  <span className="font-semibold text-primary">
                    {totalReferrals > 0 ? `${Math.round((convertedReferrals / totalReferrals) * 100)}%` : "--"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <CardTitle>Top Spenders</CardTitle>
              </div>
              <CardDescription>Highest annual spend this year</CardDescription>
            </CardHeader>
            <CardContent>
              {!customerRewards?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No customer data yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {customerRewards
                    .sort((a, b) => (b.annual_spend ?? 0) - (a.annual_spend ?? 0))
                    .slice(0, 5)
                    .map((customer, i) => (
                      <div key={customer.user_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {customer.company_name || customer.contact_name || "Unknown"}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-primary">
                          ${(customer.annual_spend ?? 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  )
}
