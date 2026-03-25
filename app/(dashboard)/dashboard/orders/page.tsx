"use client"

import { useState, useMemo } from "react"
import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"
import {
  Search,
  ArrowUpDown,
  Package,
  Truck,
  MapPin,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { orders, statusColors, type Order } from "@/lib/data/orders"

const statuses: Array<Order["status"] | "all"> = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]

export default function OrdersPage() {
  const [activeStatus, setActiveStatus] = useState<Order["status"] | "all">(
    "all"
  )
  const [search, setSearch] = useState("")
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = useMemo(() => {
    let result = [...orders]

    if (activeStatus !== "all") {
      result = result.filter((o) => o.status === activeStatus)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((o) =>
        o.orderNumber.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      const diff =
        new Date(b.date).getTime() - new Date(a.date).getTime()
      return sortAsc ? -diff : diff
    })

    return result
  }, [activeStatus, search, sortAsc])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
        <p className="mt-1 text-muted-foreground">
          View and track all your past and current orders.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={activeStatus === s ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveStatus(s)}
              className="capitalize"
            >
              {s === "all" ? "All" : s}
            </Button>
          ))}
        </div>

        {/* Search and sort */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortAsc(!sortAsc)}
            title={sortAsc ? "Sort newest first" : "Sort oldest first"}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No orders found
            </p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or search query.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {paginateArray(filtered, page, pageSize).map((order) => (
            <Card key={order.id}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {order.orderNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={statusColors[order.status]}
                >
                  {order.status.charAt(0).toUpperCase() +
                    order.status.slice(1)}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Items list */}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Items
                    </p>
                    <div className="space-y-1.5">
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
                  </div>

                  {/* Footer row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {order.trackingNumber && (
                        <span className="flex items-center gap-1.5">
                          <Truck className="h-4 w-4" />
                          {order.trackingNumber}
                        </span>
                      )}
                      {!order.trackingNumber &&
                        order.status !== "cancelled" && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            Tracking not yet available
                          </span>
                        )}
                    </div>
                    <p className="text-lg font-semibold">
                      ${order.total.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length > 0 && (
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}
    </div>
  )
}
