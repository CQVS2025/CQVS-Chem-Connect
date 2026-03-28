"use client"

import { useState } from "react"
import {
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Package,
  MapPin,
  MessageSquare,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

import {
  useAdminQuotes,
  useUpdateQuote,
  useDeleteQuote,
  type QuoteRequest,
} from "@/lib/hooks/use-quotes"
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"
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

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  reviewed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  responded: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  closed: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
}

export default function AdminQuotesPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailQuote, setDetailQuote] = useState<QuoteRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [adminNotes, setAdminNotes] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<QuoteRequest | null>(null)

  const { data: quotes, isLoading } = useAdminQuotes(statusFilter)
  const updateQuote = useUpdateQuote()
  const deleteQuote = useDeleteQuote()

  const filtered = (quotes ?? []).filter((q) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      q.product_name.toLowerCase().includes(s) ||
      q.contact_name.toLowerCase().includes(s) ||
      q.contact_email.toLowerCase().includes(s) ||
      (q.company_name?.toLowerCase().includes(s) ?? false)
    )
  })

  function openDetail(quote: QuoteRequest) {
    setDetailQuote(quote)
    setAdminNotes(quote.admin_notes || "")
    setDetailOpen(true)
  }

  function handleStatusChange(id: string, status: string) {
    const toastId = toast.loading(`Updating quote to ${status}...`)
    updateQuote.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`Quote marked as ${status}`, { id: toastId }),
        onError: () => toast.error("Unable to update quote status. Please try again.", { id: toastId }),
      },
    )
  }

  function handleSaveNotes() {
    if (!detailQuote) return
    updateQuote.mutate(
      { id: detailQuote.id, admin_notes: adminNotes },
      {
        onSuccess: () => {
          toast.success("Notes saved")
          setDetailOpen(false)
        },
        onError: () => toast.error("Unable to save notes. Please try again."),
      },
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quote Requests</h1>
          <p className="text-muted-foreground">
            Review and respond to customer quote requests.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by product, name, email, or company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Quotes Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Quotes ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Company
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Phone
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Qty
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Date
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginateArray(filtered, page, pageSize).map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="max-w-[160px] truncate font-medium">
                        {quote.product_name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {quote.contact_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {quote.contact_email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {quote.company_name || "-"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {quote.contact_phone || "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {quote.quantity}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusColors[quote.status] || ""}
                        >
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {new Date(quote.created_at).toLocaleDateString(
                          "en-AU",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openDetail(quote)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                window.open(
                                  `mailto:${quote.contact_email}?subject=Quote Request - ${quote.product_name}&body=Hi ${quote.contact_name},%0A%0ARegarding your quote request for ${quote.quantity}x ${quote.product_name}${quote.packaging_size ? ` (${quote.packaging_size})` : ""}:%0A%0A`,
                                )
                              }
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              Email Customer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(quote.id, "reviewed")
                              }
                            >
                              Mark as Reviewed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(quote.id, "responded")
                              }
                            >
                              Mark as Responded
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleStatusChange(quote.id, "closed")
                              }
                            >
                              Mark as Closed
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(quote)}
                            >
                              Delete Quote
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No quote requests found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {!isLoading && filtered.length > 0 && (
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

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quote Request Details</DialogTitle>
              <DialogDescription>
                Full details for this quote request.
              </DialogDescription>
            </DialogHeader>
            {detailQuote && (
              <div className="space-y-4 py-4">
                {/* Product */}
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <Package className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{detailQuote.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {detailQuote.quantity}
                      {detailQuote.packaging_size &&
                        ` - ${detailQuote.packaging_size}`}
                    </p>
                  </div>
                </div>

                {/* Customer contact */}
                <div className="grid gap-3">
                  <p className="text-sm font-medium">Customer Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${detailQuote.contact_email}`}
                        className="text-primary hover:underline"
                      >
                        {detailQuote.contact_email}
                      </a>
                    </div>
                    {detailQuote.contact_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{detailQuote.contact_phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{detailQuote.company_name || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Date(detailQuote.created_at).toLocaleDateString(
                          "en-AU",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery */}
                {detailQuote.delivery_location && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>{detailQuote.delivery_location}</span>
                  </div>
                )}

                {/* Message */}
                {detailQuote.message && (
                  <div className="flex items-start gap-2 text-sm">
                    <MessageSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <p className="whitespace-pre-wrap">{detailQuote.message}</p>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-3">
                  <Label>Status</Label>
                  <Badge
                    variant="outline"
                    className={statusColors[detailQuote.status] || ""}
                  >
                    {detailQuote.status}
                  </Badge>
                </div>

                {/* Admin notes */}
                <div className="grid gap-2">
                  <Label htmlFor="admin-notes">Admin Notes</Label>
                  <textarea
                    id="admin-notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal notes about this quote request..."
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      window.open(
                        `mailto:${detailQuote.contact_email}?subject=Quote Request - ${detailQuote.product_name}&body=Hi ${detailQuote.contact_name},%0A%0ARegarding your quote request for ${detailQuote.quantity}x ${detailQuote.product_name}:%0A%0A`,
                      )
                    }
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
              <Button onClick={handleSaveNotes} disabled={updateQuote.isPending}>
                {updateQuote.isPending ? "Saving..." : "Save Notes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* Delete quote confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the quote request for{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.product_name}
              </span>{" "}
              from {deleteTarget?.contact_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return
                const tid = toast.loading("Deleting quote...")
                deleteQuote.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success("Quote deleted", { id: tid })
                    setDeleteTarget(null)
                  },
                  onError: () => toast.error("Unable to delete this quote. Please try again.", { id: tid }),
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
