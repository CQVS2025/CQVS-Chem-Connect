"use client"

import { useState, useMemo } from "react"
import { domAnimation, LazyMotion, m } from "framer-motion"
import {
  Search,
  Package,
  Truck,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react"

import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrders } from "@/lib/hooks/use-orders"
import type { Order, OrderStatus } from "@/lib/types/order"

const statuses: Array<OrderStatus | "all"> = [
  "all",
  "received",
  "processing",
  "in_transit",
  "delivered",
  "cancelled",
]

const statusLabels: Record<OrderStatus, string> = {
  received: "Received",
  processing: "Processing",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const statusBadgeColors: Record<OrderStatus, string> = {
  received: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  processing: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  in_transit: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  delivered: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
}

const statusTimelineIcons: Record<string, typeof CheckCircle2> = {
  received: Package,
  processing: Loader2,
  in_transit: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
}

const paymentMethodLabels: Record<string, string> = {
  stripe: "Credit Card",
  purchase_order: "Purchase Order",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function OrderCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-20" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function OrdersPage() {
  const { data: orders, isLoading, error } = useOrders()
  const [activeStatus, setActiveStatus] = useState<OrderStatus | "all">("all")
  const [paymentFilter, setPaymentFilter] = useState<"all" | "stripe" | "purchase_order">("all")
  const [search, setSearch] = useState("")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filtered = useMemo(() => {
    if (!orders) return []

    let result = [...orders]

    if (activeStatus !== "all") {
      result = result.filter((o) => o.status === activeStatus)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((o) =>
        o.order_number.toLowerCase().includes(q)
      )
    }

    if (paymentFilter !== "all") {
      result = result.filter((o) => o.payment_method === paymentFilter)
    }

    result.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return result
  }, [orders, activeStatus, search, paymentFilter])

  const toggleExpand = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId)
  }

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
      <div className="space-y-3">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <Button
              key={s}
              variant={activeStatus === s ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveStatus(s)
                setPage(1)
              }}
              className="h-8 text-xs capitalize"
            >
              {s === "all" ? "All" : statusLabels[s]}
            </Button>
          ))}
        </div>

        {/* Search + payment filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="h-9 pl-9"
            />
          </div>
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v as typeof paymentFilter); setPage(1) }}>
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="stripe">Card</SelectItem>
              <SelectItem value="purchase_order">Purchase Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Failed to load orders
            </p>
            <p className="text-sm text-muted-foreground">
              Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No orders found
            </p>
            <p className="text-sm text-muted-foreground">
              {orders && orders.length > 0
                ? "Try adjusting your filters or search query."
                : "You haven't placed any orders yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Orders list */}
      {!isLoading && !error && filtered.length > 0 && (
        <LazyMotion features={domAnimation} strict>
          <div className="grid gap-4">
            {paginateArray(filtered, page, pageSize).map(
              (order: Order, index: number) => (
                <m.div
                  key={order.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: "easeOut",
                  }}
                >
                  <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {order.order_number}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusBadgeColors[order.status]}
                        >
                          {statusLabels[order.status]}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <CreditCard className="h-3 w-3" />
                          {paymentMethodLabels[order.payment_method] ||
                            order.payment_method}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Summary row */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Package className="h-4 w-4" />
                              {order.items.length}{" "}
                              {order.items.length === 1 ? "item" : "items"}
                            </span>
                            {order.macship_tracking_url ? (
                              <a
                                href={order.macship_tracking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Truck className="h-4 w-4" />
                                Track Shipment
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : order.tracking_number ? (
                              <span className="flex items-center gap-1.5">
                                <Truck className="h-4 w-4" />
                                {order.tracking_number}
                              </span>
                            ) : order.status !== "cancelled" &&
                              order.status !== "delivered" ? (
                              <span className="flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                Tracking not yet available
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-lg font-semibold">
                              AUD {order.total.toLocaleString("en-AU", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(order.id)}
                              className="gap-1"
                            >
                              {expandedOrder === order.id ? (
                                <>
                                  Hide Details
                                  <ChevronUp className="h-4 w-4" />
                                </>
                              ) : (
                                <>
                                  View Details
                                  <ChevronDown className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {expandedOrder === order.id && (
                          <m.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            transition={{ duration: 0.25 }}
                            className="space-y-4 overflow-hidden"
                          >
                            {/* Items list */}
                            <div className="rounded-lg border bg-muted/30 p-3">
                              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Items
                              </p>
                              <div className="space-y-1.5">
                                {order.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span>
                                      {item.product_name}{" "}
                                      <span className="text-muted-foreground">
                                        x{item.quantity} ({item.packaging_size})
                                      </span>
                                    </span>
                                    <span className="font-medium">
                                      AUD {item.total_price.toLocaleString(
                                        "en-AU",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 border-t pt-2 space-y-1 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Subtotal</span>
                                  <span>
                                    AUD {order.subtotal.toLocaleString("en-AU", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                {(order.bundle_discount ?? 0) > 0 && (
                                  <div className="flex justify-between text-primary text-xs">
                                    <span>Bundle Discount</span>
                                    <span>-AUD {order.bundle_discount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {order.first_order_type === "free_freight" && (
                                  <div className="flex justify-between text-sky-400 text-xs">
                                    <span>First Order - Free Freight</span>
                                    <span>Applied</span>
                                  </div>
                                )}
                                {(order.first_order_discount ?? 0) > 0 && order.first_order_type !== "free_freight" && (
                                  <div className="flex justify-between text-primary text-xs">
                                    <span>First Order - 50% Off Truck Wash</span>
                                    <span>-AUD {order.first_order_discount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {(order.promo_discount ?? 0) > 0 && (
                                  <div className="flex justify-between text-violet-400 text-xs">
                                    <span>{order.promo_names || "Promotion Discount"}</span>
                                    <span>-AUD {order.promo_discount.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {(order.container_total ?? 0) > 0 && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Container Costs</span>
                                    <span>
                                      AUD {order.container_total.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Shipping</span>
                                  <span>
                                    {order.shipping > 0
                                      ? `AUD ${order.shipping.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                                      : "Free"}
                                  </span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>GST</span>
                                  <span>
                                    AUD {order.gst.toLocaleString("en-AU", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                                {order.processing_fee > 0 && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>Card Processing Fee</span>
                                    <span>
                                      AUD {order.processing_fee.toLocaleString("en-AU", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between font-semibold">
                                  <span>Total</span>
                                  <span>
                                    AUD {order.total.toLocaleString("en-AU", {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Delivery address */}
                            {order.delivery_address_street && (
                              <div className="rounded-lg border bg-muted/30 p-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Delivery Address
                                </p>
                                <div className="flex items-start gap-2 text-sm">
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                  <p>
                                    {order.delivery_address_street}
                                    <br />
                                    {order.delivery_address_city},{" "}
                                    {order.delivery_address_state}{" "}
                                    {order.delivery_address_postcode}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Tracking info */}
                            {(order.tracking_number || order.macship_tracking_url) && (
                              <div className="rounded-lg border bg-muted/30 p-3">
                                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Tracking
                                </p>
                                {order.macship_tracking_url ? (
                                  <div className="space-y-2">
                                    <a
                                      href={order.macship_tracking_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                                    >
                                      <Truck className="h-4 w-4" />
                                      Track Shipment
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                    {order.macship_pickup_date && !order.macship_dispatched_at && (
                                      <p className="text-xs text-muted-foreground">
                                        Estimated dispatch:{" "}
                                        {formatDate(order.macship_pickup_date)}
                                      </p>
                                    )}
                                    {order.macship_dispatched_at && (
                                      <p className="text-xs text-muted-foreground">
                                        Dispatched:{" "}
                                        {formatDate(order.macship_dispatched_at)}
                                      </p>
                                    )}
                                    {order.estimated_delivery && (
                                      <p className="text-xs text-muted-foreground">
                                        Estimated delivery:{" "}
                                        {formatDate(order.estimated_delivery)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 text-sm">
                                      <Truck className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-mono">
                                        {order.tracking_number}
                                      </span>
                                    </div>
                                    {order.estimated_delivery && (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Estimated delivery:{" "}
                                        {formatDate(order.estimated_delivery)}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* Status timeline */}
                            {order.status_history &&
                              order.status_history.length > 0 && (
                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Status Timeline
                                  </p>
                                  <div className="relative space-y-0">
                                    {order.status_history.map(
                                      (history, idx) => {
                                        const Icon =
                                          statusTimelineIcons[
                                            history.status
                                          ] || Clock
                                        const isLast =
                                          idx ===
                                          order.status_history!.length - 1
                                        return (
                                          <div
                                            key={history.id}
                                            className="relative flex gap-3 pb-4 last:pb-0"
                                          >
                                            {/* Line */}
                                            {!isLast && (
                                              <div className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-border" />
                                            )}
                                            {/* Icon */}
                                            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-border">
                                              <Icon className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium capitalize">
                                                {history.status.replace(
                                                  "_",
                                                  " "
                                                )}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {formatDateTime(
                                                  history.created_at
                                                )}
                                              </p>
                                              {history.note && (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                  {history.note}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      }
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* PO number */}
                            {order.po_number && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>PO Number: {order.po_number}</span>
                              </div>
                            )}
                          </m.div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </m.div>
              )
            )}

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
        </LazyMotion>
      )}
    </div>
  )
}
