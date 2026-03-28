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
  MapPin,
  Trash2,
} from "lucide-react"

import {
  useAdminOrders,
  useUpdateOrderStatus,
  useDeleteOrder,
} from "@/lib/hooks/use-orders"
import type { Order, OrderStatus } from "@/lib/types/order"
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

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all")
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

    result.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return result
  }, [orders, search])

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

        {/* Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by order number or customer name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status Tabs and Table */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as OrderStatus | "all")
            setPage(1)
          }}
        >
          <TabsList>
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {statusLabels[tab]} ({statusCounts[tab]})
              </TabsTrigger>
            ))}
          </TabsList>

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
                                  $
                                  {order.total.toLocaleString("en-AU", {
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
                                                $
                                                {item.total_price.toLocaleString(
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
                                              $
                                              {order.subtotal.toLocaleString(
                                                "en-AU",
                                                { minimumFractionDigits: 2 }
                                              )}
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>Shipping</span>
                                            <span>
                                              $
                                              {order.shipping.toLocaleString(
                                                "en-AU",
                                                { minimumFractionDigits: 2 }
                                              )}
                                            </span>
                                          </div>
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>GST</span>
                                            <span>
                                              $
                                              {order.gst.toLocaleString(
                                                "en-AU",
                                                { minimumFractionDigits: 2 }
                                              )}
                                            </span>
                                          </div>
                                          <div className="flex justify-between font-semibold">
                                            <span>Total</span>
                                            <span>
                                              $
                                              {order.total.toLocaleString(
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
