import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  try {
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    // Fetch all orders with items
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, user_id, status, payment_method, payment_status, subtotal, shipping, gst, total, created_at, order_items(product_name, quantity, unit_price, total_price)")
      .order("created_at", { ascending: false })

    // Fetch user count
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")

    // Fetch total products
    const { count: totalProducts } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })

    // Fetch low stock products
    const { data: lowStockProducts } = await supabase
      .from("products")
      .select("id, name, category, stock_qty")
      .gt("stock_qty", 0)
      .lt("stock_qty", 100)
      .order("stock_qty", { ascending: true })

    // Fetch recent users (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { count: newUsersThisMonth } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", thirtyDaysAgo.toISOString())

    // Fetch quote requests count
    const { count: pendingQuotes } = await supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")

    // Process orders for analytics
    const allOrders = orders ?? []
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    const totalRevenue = allOrders
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + Number(o.total), 0)

    const activeOrders = allOrders.filter(
      (o) => o.status === "received" || o.status === "processing" || o.status === "in_transit",
    ).length

    const ordersThisMonth = allOrders.filter((o) => {
      const d = new Date(o.created_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })

    const revenueThisMonth = ordersThisMonth
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + Number(o.total), 0)

    const avgOrderValue =
      allOrders.length > 0 ? totalRevenue / allOrders.filter((o) => o.payment_status === "paid").length : 0

    // Monthly revenue for last 6 months
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1)
      const monthOrders = allOrders.filter((o) => {
        const od = new Date(o.created_at)
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear()
      })
      const revenue = monthOrders
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + Number(o.total), 0)
      monthlyData.push({
        month: d.toLocaleDateString("en-AU", { month: "short" }),
        fullMonth: d.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
        revenue: Math.round(revenue * 100) / 100,
        orders: monthOrders.length,
      })
    }

    // Order status distribution
    const statusCounts: Record<string, number> = {}
    for (const o of allOrders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1
    }

    // Top products by quantity sold
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {}
    for (const o of allOrders) {
      if (o.payment_status !== "paid") continue
      const items = (o as Record<string, unknown>).order_items as { product_name: string; quantity: number; total_price: number }[] | undefined
      if (!items) continue
      for (const item of items) {
        if (!productSales[item.product_name]) {
          productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 }
        }
        productSales[item.product_name].qty += item.quantity
        productSales[item.product_name].revenue += Number(item.total_price)
      }
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Payment method distribution
    const paymentMethods: Record<string, number> = {}
    for (const o of allOrders) {
      paymentMethods[o.payment_method] = (paymentMethods[o.payment_method] || 0) + 1
    }

    // Recent 5 orders for overview
    const recentOrders = allOrders.slice(0, 5).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      paymentStatus: o.payment_status,
      total: Number(o.total),
      createdAt: o.created_at,
      userId: o.user_id,
    }))

    // Fetch profiles for recent order customers
    const userIds = [...new Set(recentOrders.map((o) => o.userId))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, contact_name, company_name, email")
      .in("id", userIds)

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p]),
    )

    const recentOrdersWithCustomer = recentOrders.map((o) => ({
      ...o,
      customer: profileMap.get(o.userId)?.company_name || profileMap.get(o.userId)?.contact_name || "Unknown",
    }))

    return NextResponse.json({
      stats: {
        totalProducts: totalProducts ?? 0,
        totalUsers: totalUsers ?? 0,
        activeOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
        ordersThisMonth: ordersThisMonth.length,
        totalOrders: allOrders.length,
        avgOrderValue: Math.round((avgOrderValue || 0) * 100) / 100,
        newUsersThisMonth: newUsersThisMonth ?? 0,
        pendingQuotes: pendingQuotes ?? 0,
      },
      monthlyData,
      statusCounts,
      topProducts,
      paymentMethods,
      lowStockProducts: (lowStockProducts ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        stockQty: p.stock_qty,
      })),
      recentOrders: recentOrdersWithCustomer,
    })
  } catch (err) {
    console.error("GET /api/analytics error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
