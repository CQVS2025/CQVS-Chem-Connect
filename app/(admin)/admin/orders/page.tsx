"use client"

import { Fragment, useState, useMemo } from "react"
import { toast } from "sonner"
import {
  Search,
  MoreHorizontal,
  Eye,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  FileDown,
  MapPin,
  Paperclip,
  Trash2,
  ExternalLink,
  FileText,
} from "lucide-react"

import { useQueryClient } from "@tanstack/react-query"
import {
  useAdminOrders,
  useUpdateOrderStatus,
  useDeleteOrder,
} from "@/lib/hooks/use-orders"
import { useOrderDocuments } from "@/lib/hooks/use-order-documents"
import type { Order, OrderStatus } from "@/lib/types/order"

type AdminOrder = Order & {
  macship_consignment_id?: string | null
  macship_pickup_date?: string | null
  macship_dispatched_at?: string | null
  macship_tracking_url?: string | null
  macship_consignment_failed?: boolean | null
  macship_lead_time_fallback?: boolean | null
  xero_invoice_id?: string | null
  xero_invoice_number?: string | null
  xero_po_id?: string | null
  xero_po_number?: string | null
}
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageTransition } from "@/components/shared/page-transition"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const statusTabs: Array<OrderStatus | "all"> = [
  "all",
  "received",
  "processing",
  "in_transit",
  "delivered",
  "cancelled",
]

const statusLabels: Record<OrderStatus | "all", string> = {
  all: "All",
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

const paymentMethodLabels: Record<string, string> = {
  stripe: "Credit Card",
  purchase_order: "Purchase Order",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
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

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  )
}

// Inline component to fetch and display PO documents for an order
function OrderDocuments({ orderId }: { orderId: string }) {
  const { data: docs = [], isLoading: loading } = useOrderDocuments(orderId)

  if (loading) return (
    <div>
      <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        PO Documents
      </h4>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 animate-pulse">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
  if (docs.length === 0) return null

  return (
    <div>
      <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        PO Documents ({docs.length})
      </h4>
      <div className="space-y-2">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{doc.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {(doc.file_size / 1024).toFixed(0)} KB - {doc.file_type.split("/").pop()?.toUpperCase()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={doc.view_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                View
              </a>
              <a
                href={doc.signed_url}
                download={doc.file_name}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <FileDown className="h-3 w-3" />
                Download
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all")
  const [paymentFilter, setPaymentFilter] = useState<"all" | "stripe" | "purchase_order">("all")
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Status update dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState<OrderStatus>("processing")
  const [statusNote, setStatusNote] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)

  const adminFilter = activeTab === "all" ? {} : { status: activeTab }
  const { data: orders, isLoading } = useAdminOrders(adminFilter)
  const updateStatus = useUpdateOrderStatus()
  const deleteOrder = useDeleteOrder()

  const filtered = useMemo(() => {
    if (!orders) return []

    let result = [...orders]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.profile?.contact_name?.toLowerCase().includes(q) ?? false) ||
          (o.profile?.company_name?.toLowerCase().includes(q) ?? false)
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
  }, [orders, search, paymentFilter])

  const statusCounts = useMemo(() => {
    if (!orders)
      return { all: 0, received: 0, processing: 0, in_transit: 0, delivered: 0, cancelled: 0 }
    return {
      all: orders.length,
      received: orders.filter((o) => o.status === "received").length,
      processing: orders.filter((o) => o.status === "processing").length,
      in_transit: orders.filter((o) => o.status === "in_transit").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    }
  }, [orders])

  function openStatusDialog(order: Order, status?: OrderStatus) {
    setSelectedOrder(order)
    setNewStatus(status || order.status)
    setStatusNote("")
    setTrackingNumber(order.tracking_number || "")
    setStatusDialogOpen(true)
  }

  async function handleStatusUpdate() {
    if (!selectedOrder) return

    try {
      await updateStatus.mutateAsync({
        id: selectedOrder.id,
        status: newStatus,
        note: statusNote || undefined,
        tracking_number: trackingNumber || undefined,
      })
      toast.success(
        `Order ${selectedOrder.order_number} updated to ${statusLabels[newStatus]}`
      )
      setStatusDialogOpen(false)
    } catch {
      toast.error("Failed to update order status. Please try again.")
    }
  }

  function openTrackingDialog(order: Order) {
    setSelectedOrder(order)
    setNewStatus(order.status)
    setStatusNote("")
    setTrackingNumber(order.tracking_number || "")
    setStatusDialogOpen(true)
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

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search order or customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="h-9 pl-9"
            />
          </div>
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v as typeof paymentFilter); setPage(1) }}>
            <SelectTrigger className="h-9 w-full sm:w-44">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="stripe">Card (Stripe)</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
              </SelectContent>
          </Select>
        </div>

        {/* Status Tabs and Table */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as OrderStatus | "all")
            setPage(1)
          }}
        >
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0">
              {statusTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm whitespace-nowrap">
                  {statusLabels[tab]} ({statusCounts[tab]})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeTab}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {statusLabels[activeTab]} Orders ({filtered.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TableSkeleton />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8" />
                          <TableHead>Order #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginateArray(filtered, page, pageSize).map(
                          (order: Order) => (
                            <Fragment key={order.id}>
                              <TableRow>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() =>
                                      setExpandedOrder(
                                        expandedOrder === order.id
                                          ? null
                                          : order.id
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
                                  {order.order_number}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {order.profile?.company_name || "N/A"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {order.profile?.contact_name ||
                                        order.profile?.email ||
                                        "Unknown"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {formatDate(order.created_at)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={
                                      statusBadgeColors[order.status]
                                    }
                                  >
                                    {statusLabels[order.status]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {paymentMethodLabels[
                                      order.payment_method
                                    ] || order.payment_method}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {order.items.length}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  AUD {order.total.toLocaleString("en-AU", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">
                                          Actions
                                        </span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>
                                        Actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setExpandedOrder(
                                            expandedOrder === order.id
                                              ? null
                                              : order.id
                                          )
                                        }
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          Update Status
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openStatusDialog(
                                                order,
                                                "received"
                                              )
                                            }
                                          >
                                            <Package className="mr-2 h-4 w-4" />
                                            Received
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openStatusDialog(
                                                order,
                                                "processing"
                                              )
                                            }
                                          >
                                            <Loader2 className="mr-2 h-4 w-4" />
                                            Processing
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openStatusDialog(
                                                order,
                                                "in_transit"
                                              )
                                            }
                                          >
                                            <Truck className="mr-2 h-4 w-4" />
                                            In Transit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openStatusDialog(
                                                order,
                                                "delivered"
                                              )
                                            }
                                          >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Delivered
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              openStatusDialog(
                                                order,
                                                "cancelled"
                                              )
                                            }
                                            className="text-red-600"
                                          >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Cancelled
                                          </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          openTrackingDialog(order)
                                        }
                                      >
                                        <Truck className="mr-2 h-4 w-4" />
                                        Add Tracking Number
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => setDeleteTarget(order)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Order
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>

                              {/* Expanded details */}
                              {expandedOrder === order.id && (
                                <TableRow key={`${order.id}-details`}>
                                  <TableCell colSpan={9}>
                                    <div className="space-y-4 rounded-lg bg-muted/50 p-4">
                                      {/* Order items */}
                                      <div>
                                        <h4 className="mb-3 text-sm font-medium flex items-center gap-2">
                                          <Package className="h-4 w-4" />
                                          Order Items
                                        </h4>
                                        <div className="space-y-2">
                                          {order.items.map((item) => (
                                            <div
                                              key={item.id}
                                              className="flex items-center justify-between text-sm"
                                            >
                                              <span>
                                                {item.product_name}{" "}
                                                <span className="text-muted-foreground">
                                                  x{item.quantity} (
                                                  {item.packaging_size})
                                                </span>
                                              </span>
                                              <span className="font-medium">
                                                AUD {item.total_price.toLocaleString(
                                                  "en-AU",
                                                  {
                                                    minimumFractionDigits: 2,
                                                  }
                                                )}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="mt-2 border-t pt-2 text-sm">
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>Subtotal</span>
                                            <span>
                                              AUD {order.subtotal.toLocaleString(
                                                "en-AU",
                                                { minimumFractionDigits: 2 }
                                              )}
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
                                            <>
                                              <div className="flex justify-between text-muted-foreground">
                                                <span>Container Costs</span>
                                                <span>
                                                  AUD {order.container_total.toLocaleString(
                                                    "en-AU",
                                                    { minimumFractionDigits: 2 },
                                                  )}
                                                </span>
                                              </div>
                                              <div className="space-y-0.5 ml-4 pl-3 border-l-2 border-border">
                                                {order.items
                                                  .filter((i) => (i.container_cost ?? 0) > 0)
                                                  .map((item) => (
                                                    <div
                                                      key={item.id}
                                                      className="flex justify-between text-xs text-muted-foreground"
                                                    >
                                                      <span className="truncate max-w-40">
                                                        {item.packaging_size} Container
                                                        {item.quantity > 1
                                                          ? ` x ${item.quantity}`
                                                          : ""}
                                                      </span>
                                                      <span className="shrink-0 ml-2">
                                                        AUD {(
                                                          item.container_cost * item.quantity
                                                        ).toFixed(2)}
                                                      </span>
                                                    </div>
                                                  ))}
                                              </div>
                                            </>
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
                                              AUD {order.gst.toLocaleString(
                                                "en-AU",
                                                { minimumFractionDigits: 2 }
                                              )}
                                            </span>
                                          </div>
                                          {order.processing_fee > 0 && (
                                            <div className="flex justify-between text-muted-foreground">
                                              <span>Card Processing Fee</span>
                                              <span>
                                                AUD {order.processing_fee.toLocaleString(
                                                  "en-AU",
                                                  { minimumFractionDigits: 2 }
                                                )}
                                              </span>
                                            </div>
                                          )}
                                          <div className="flex justify-between font-semibold">
                                            <span>Total</span>
                                            <span>
                                              AUD {order.total.toLocaleString(
                                                "en-AU",
                                                { minimumFractionDigits: 2 }
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Delivery address */}
                                      {order.delivery_address_street && (
                                        <div>
                                          <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Delivery Address
                                          </h4>
                                          <p className="text-sm text-muted-foreground">
                                            {order.delivery_address_street}
                                            <br />
                                            {order.delivery_address_city},{" "}
                                            {order.delivery_address_state}{" "}
                                            {order.delivery_address_postcode}
                                          </p>
                                        </div>
                                      )}

                                      {/* PO Documents */}
                                      {order.payment_method === "purchase_order" && (
                                        <OrderDocuments orderId={order.id} />
                                      )}

                                      {/* Forklift / delivery flag */}
                                      {order.forklift_available != null && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Forklift on site: </span>
                                          <span className="font-medium">
                                            {order.forklift_available ? "Yes" : "No (tailgate required)"}
                                          </span>
                                        </div>
                                      )}

                                      {/* Invoice email */}
                                      {order.invoice_email && (
                                        <div className="text-sm">
                                          <span className="text-muted-foreground">Invoice sent to: </span>
                                          <span className="font-medium">{order.invoice_email}</span>
                                        </div>
                                      )}

                                      {/* Tracking */}
                                      {order.tracking_number && (
                                        <div>
                                          <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
                                            <Truck className="h-4 w-4" />
                                            Tracking
                                          </h4>
                                          <p className="font-mono text-sm">
                                            {order.tracking_number}
                                          </p>
                                          {order.estimated_delivery && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              Estimated delivery:{" "}
                                              {formatDate(
                                                order.estimated_delivery
                                              )}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Status history */}
                                      {order.status_history &&
                                        order.status_history.length > 0 && (
                                          <div>
                                            <h4 className="mb-2 text-sm font-medium flex items-center gap-2">
                                              <Clock className="h-4 w-4" />
                                              Status History
                                            </h4>
                                            <div className="space-y-2">
                                              {order.status_history.map(
                                                (h) => (
                                                  <div
                                                    key={h.id}
                                                    className="flex items-start gap-2 text-sm"
                                                  >
                                                    <Badge
                                                      variant="outline"
                                                      className={`text-xs capitalize ${
                                                        statusBadgeColors[
                                                          h.status as OrderStatus
                                                        ] || ""
                                                      }`}
                                                    >
                                                      {h.status.replace(
                                                        "_",
                                                        " "
                                                      )}
                                                    </Badge>
                                                    <span className="text-muted-foreground">
                                                      {formatDateTime(
                                                        h.created_at
                                                      )}
                                                    </span>
                                                    {h.note && (
                                                      <span className="text-muted-foreground">
                                                        - {h.note}
                                                      </span>
                                                    )}
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        )}

                                      {/* PO number */}
                                      {order.po_number && (
                                        <p className="text-sm text-muted-foreground">
                                          PO Number: {order.po_number}
                                        </p>
                                      )}

                                      {/* MacShip & Xero Info */}
                                      <div className="mt-4 border-t pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {/* MacShip section */}
                                        <div className="space-y-2">
                                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Shipping (MacShip)
                                          </h4>
                                          {(order as AdminOrder).macship_consignment_id ? (
                                            <div className="space-y-1 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground text-xs">Consignment:</span>
                                                <span className="font-mono text-xs">{(order as AdminOrder).macship_consignment_id}</span>
                                              </div>
                                              {(order as AdminOrder).macship_pickup_date && (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-muted-foreground text-xs">Pickup date:</span>
                                                  <span className="text-xs font-medium">
                                                    {new Date((order as AdminOrder).macship_pickup_date!).toLocaleDateString("en-AU", {
                                                      day: "numeric",
                                                      month: "short",
                                                      year: "numeric",
                                                    })}
                                                  </span>
                                                </div>
                                              )}
                                              {(order as AdminOrder).macship_tracking_url && (
                                                <a
                                                  href={(order as AdminOrder).macship_tracking_url!}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                  Track Shipment
                                                </a>
                                              )}
                                              {!(order as AdminOrder).macship_dispatched_at ? (
                                                <DispatchButton order={order as AdminOrder} />
                                              ) : (
                                                <span className="flex items-center gap-1 text-xs text-emerald-500">
                                                  <CheckCircle2 className="h-3 w-3" />
                                                  Dispatched {new Date((order as AdminOrder).macship_dispatched_at!).toLocaleDateString("en-AU")}
                                                </span>
                                              )}
                                              <PrintLabelsButton
                                                consignmentId={(order as AdminOrder).macship_consignment_id!}
                                              />
                                            </div>
                                          ) : (
                                            <div className="space-y-1">
                                              {(order as AdminOrder).macship_consignment_failed ? (
                                                <span className="text-xs text-amber-500">⚠ Consignment creation failed - book manually</span>
                                              ) : (
                                                <span className="text-xs text-muted-foreground">No MacShip consignment</span>
                                              )}
                                              {(order as AdminOrder).macship_lead_time_fallback && (
                                                <p className="text-xs text-amber-400">⚠ Used 5-day lead time fallback - configure lead times</p>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* Xero section */}
                                        <div className="space-y-2">
                                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Xero Accounting
                                          </h4>
                                          <div className="space-y-1">
                                            {(order as AdminOrder).xero_invoice_id ? (
                                              <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground text-xs">Invoice:</span>
                                                <span className="font-mono text-xs">{(order as AdminOrder).xero_invoice_number || (order as AdminOrder).xero_invoice_id}</span>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-5 px-1 text-xs"
                                                  onClick={async () => {
                                                    try {
                                                      const res = await fetch(`/api/xero/invoices/${(order as AdminOrder).xero_invoice_id}/url`)
                                                      if (res.ok) {
                                                        const { url } = await res.json()
                                                        window.open(url, "_blank")
                                                      } else {
                                                        toast.error("Could not open Xero invoice")
                                                      }
                                                    } catch {
                                                      toast.error("Could not open Xero invoice")
                                                    }
                                                  }}
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">No Xero invoice</span>
                                                {order.payment_method === "purchase_order" && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 px-1 text-xs text-primary"
                                                    onClick={async () => {
                                                      try {
                                                        const res = await fetch("/api/xero/invoices", {
                                                          method: "POST",
                                                          headers: { "Content-Type": "application/json" },
                                                          body: JSON.stringify({ order_id: order.id }),
                                                        })
                                                        if (res.ok) {
                                                          toast.success("Xero invoice created")
                                                        } else {
                                                          toast.error("Failed to create invoice")
                                                        }
                                                      } catch {
                                                        toast.error("Failed to create invoice")
                                                      }
                                                    }}
                                                  >
                                                    Create
                                                  </Button>
                                                )}
                                              </div>
                                            )}
                                            {(order as AdminOrder).xero_po_id ? (
                                              <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground text-xs">PO:</span>
                                                <span className="font-mono text-xs">{(order as AdminOrder).xero_po_number || (order as AdminOrder).xero_po_id}</span>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-5 px-1 text-xs"
                                                  onClick={async () => {
                                                    try {
                                                      const res = await fetch(`/api/xero/purchase-orders/${(order as AdminOrder).xero_po_id}/url`)
                                                      if (res.ok) {
                                                        const { url } = await res.json()
                                                        window.open(url, "_blank")
                                                      } else {
                                                        toast.error("Could not open Xero PO")
                                                      }
                                                    } catch {
                                                      toast.error("Could not open Xero PO")
                                                    }
                                                  }}
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">No Xero PO</span>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-5 px-1 text-xs text-primary"
                                                  onClick={async () => {
                                                    try {
                                                      const res = await fetch("/api/xero/purchase-orders", {
                                                        method: "POST",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ order_id: order.id }),
                                                      })
                                                      if (res.ok) {
                                                        toast.success("Xero PO created")
                                                      } else {
                                                        toast.error("Failed to create PO")
                                                      }
                                                    } catch {
                                                      toast.error("Failed to create PO")
                                                    }
                                                  }}
                                                >
                                                  Create
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          )
                        )}
                        {!isLoading && filtered.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={9}
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
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Status Update Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Update Order Status</DialogTitle>
              <DialogDescription>
                {selectedOrder
                  ? `Update status for order ${selectedOrder.order_number}`
                  : "Update order status"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="status-select">New Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={(val) => setNewStatus(val as OrderStatus)}
                >
                  <SelectTrigger id="status-select">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking-input">
                  Tracking Number (optional)
                </Label>
                <Input
                  id="tracking-input"
                  placeholder="e.g. TRK-AU-1234567"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note-input">Note (optional)</Label>
                <Input
                  id="note-input"
                  placeholder="Add a note about this status change..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStatusUpdate}
                disabled={updateStatus.isPending}
              >
                {updateStatus.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Delete order confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.order_number}
              </span>
              ? This action cannot be undone and will remove it from the
              customer&apos;s dashboard as well.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return
                const tid = toast.loading("Deleting order...")
                deleteOrder.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success("Order deleted", { id: tid })
                    setDeleteTarget(null)
                  },
                  onError: () => toast.error("Unable to delete this order. Please try again.", { id: tid }),
                })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  )
}

function DispatchButton({ order }: { order: AdminOrder }) {
  const queryClient = useQueryClient()
  const [isDispatching, setIsDispatching] = useState(false)
  const [isOverriding, setIsOverriding] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pickupDate = order.macship_pickup_date ? new Date(order.macship_pickup_date) : null
  if (pickupDate) pickupDate.setHours(0, 0, 0, 0)

  const isReady = !pickupDate || today >= pickupDate || isOverriding
  const daysUntilReady = pickupDate ? Math.ceil((pickupDate.getTime() - today.getTime()) / 86400000) : 0

  async function handleDispatch() {
    setIsDispatching(true)
    try {
      const res = await fetch("/api/macship/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      })
      if (res.ok) {
        toast.success("Order dispatched - carrier notified!")
        queryClient.invalidateQueries({ queryKey: ["orders"] })
      } else {
        const { error } = await res.json()
        toast.error(error || "Dispatch failed")
      }
    } catch {
      toast.error("Dispatch failed")
    } finally {
      setIsDispatching(false)
    }
  }

  return (
    <div className="space-y-1">
      {!isReady && (
        <p className="text-xs text-amber-500">
          Ready for dispatch on {pickupDate?.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          {daysUntilReady > 0 ? ` (${daysUntilReady}d)` : ""}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isReady ? "default" : "outline"}
          disabled={!isReady || isDispatching}
          onClick={handleDispatch}
          className="h-7 text-xs"
        >
          {isDispatching ? (
            <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Dispatching...</>
          ) : (
            <><Truck className="mr-1 h-3 w-3" />Dispatch</>
          )}
        </Button>
        {!isReady && !isOverriding && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setIsOverriding(true)}
          >
            Override
          </button>
        )}
      </div>
    </div>
  )
}

function PrintLabelsButton({ consignmentId }: { consignmentId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/macship/labels?consignment_id=${consignmentId}`)
      const contentType = res.headers.get("content-type") || ""

      // PDF returned → open it in a new tab
      if (contentType.includes("application/pdf")) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
        // Revoke after a delay so the browser has time to load it
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }

      // JSON response - either an error or the "carrier handles own labels" flag
      const data = await res.json()
      if (data.carrier_handles_own_labels) {
        toast.info(
          data.message ||
            "This carrier handles its own labels directly (no Machship label required)",
        )
      } else {
        toast.error(data.error || "Could not fetch labels")
      }
    } catch {
      toast.error("Could not fetch labels")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
      Print Labels
    </button>
  )
}
