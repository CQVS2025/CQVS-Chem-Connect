"use client"

import { Fragment, useState } from "react"
import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"
import {
  Search,
  MoreHorizontal,
  Eye,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react"

import { orders as baseOrders, statusColors } from "@/lib/data/orders"
import type { Order } from "@/lib/data/orders"
import { PageTransition } from "@/components/shared/page-transition"
import {
  Card,
  CardContent,
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
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/* ------------------------------------------------------------------ */
/*  Additional admin orders                                           */
/* ------------------------------------------------------------------ */

const adminOrders: Order[] = [
  {
    id: "7",
    orderNumber: "ORD-2026-007",
    date: "2026-03-22",
    status: "pending",
    items: [
      { name: "Truck Wash Premium", qty: 10, price: 1.95, unit: "200L Drum" },
    ],
    total: 3900,
  },
  {
    id: "8",
    orderNumber: "ORD-2026-008",
    date: "2026-03-21",
    status: "processing",
    items: [
      { name: "Green Acid Replacement", qty: 5, price: 2.45, unit: "1000L IBC" },
      { name: "Eco Wash", qty: 3, price: 1.8, unit: "200L Drum" },
    ],
    total: 13330,
  },
  {
    id: "9",
    orderNumber: "ORD-2026-009",
    date: "2026-03-19",
    status: "shipped",
    items: [
      { name: "Agi Acid", qty: 4, price: 2.06, unit: "200L Drum" },
    ],
    total: 1648,
    trackingNumber: "TRK-AU-5039281",
  },
  {
    id: "10",
    orderNumber: "ORD-2026-010",
    date: "2026-03-17",
    status: "pending",
    items: [
      { name: "AdBlue (DEF)", qty: 8, price: 1.15, unit: "1000L IBC" },
    ],
    total: 9200,
  },
  {
    id: "11",
    orderNumber: "ORD-2026-011",
    date: "2026-03-15",
    status: "delivered",
    items: [
      { name: "Sodium Hydroxide (NaOH) - 50kg", qty: 20, price: 85.0, unit: "50kg Bag" },
    ],
    total: 1700,
    trackingNumber: "TRK-AU-4928371",
  },
]

const customerNames: Record<string, string> = {
  "1": "Acme Corp",
  "2": "BioLab Inc",
  "3": "CleanTech Solutions",
  "4": "QuarryMax Pty Ltd",
  "5": "Pacific Concrete",
  "6": "GreenBuild Industries",
  "7": "Northern Mining Co",
  "8": "Westfield Precast",
  "9": "Brisbane Haulage",
  "10": "Adelaide Cement Works",
  "11": "Sydney Water Treatment",
}

const allOrders = [...baseOrders, ...adminOrders]

const statusTabs = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = allOrders.filter((order) => {
    const matchesSearch = order.orderNumber
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesStatus =
      activeTab === "all" || order.status === activeTab
    return matchesSearch && matchesStatus
  })

  const statusCounts = {
    all: allOrders.length,
    pending: allOrders.filter((o) => o.status === "pending").length,
    processing: allOrders.filter((o) => o.status === "processing").length,
    shipped: allOrders.filter((o) => o.status === "shipped").length,
    delivered: allOrders.filter((o) => o.status === "delivered").length,
    cancelled: allOrders.filter((o) => o.status === "cancelled").length,
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Track and manage all customer orders.
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status Tabs and Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab} ({statusCounts[tab]})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === "all" ? "All" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Orders ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginateArray(filtered, page, pageSize).map((order) => (
                      <Fragment key={order.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                setExpandedOrder(
                                  expandedOrder === order.id ? null : order.id
                                )
                              }
                            >
                              {expandedOrder === order.id ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {order.orderNumber}
                          </TableCell>
                          <TableCell className="font-medium">
                            {customerNames[order.id] ?? "Unknown"}
                          </TableCell>
                          <TableCell>{order.date}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`capitalize ${statusColors[order.status]}`}
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {order.items.length}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${order.total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                                <DropdownMenuItem>
                                  Set as Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  Set as Processing
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  Set as Shipped
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  Set as Delivered
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive">
                                  Cancel Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Expanded details */}
                        {expandedOrder === order.id && (
                          <TableRow key={`${order.id}-details`}>
                            <TableCell colSpan={8}>
                              <div className="rounded-lg bg-muted/50 p-4">
                                <h4 className="mb-3 text-sm font-medium flex items-center gap-2">
                                  <Package className="h-4 w-4" />
                                  Order Items
                                </h4>
                                <div className="space-y-2">
                                  {order.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span>
                                        {item.name}{" "}
                                        <span className="text-muted-foreground">
                                          x{item.qty} ({item.unit})
                                        </span>
                                      </span>
                                      <span className="font-medium">
                                        ${(item.price * item.qty).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {order.trackingNumber && (
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    Tracking: {order.trackingNumber}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          No orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {filtered.length > 0 && (
                  <TablePagination
                    page={page}
                    pageSize={pageSize}
                    totalItems={filtered.length}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  )
}
