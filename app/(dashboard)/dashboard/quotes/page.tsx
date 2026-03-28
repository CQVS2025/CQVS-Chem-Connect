"use client"

import { useState } from "react"
import Link from "next/link"
import {
  FileText,
  Package,
  Clock,
  CheckCircle,
  MessageSquare,
  Search,
} from "lucide-react"
import { domAnimation, LazyMotion, m } from "framer-motion"

import { useQuotes, type QuoteRequest } from "@/lib/hooks/use-quotes"
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
import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending Review",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  reviewed: {
    label: "Under Review",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: FileText,
  },
  responded: {
    label: "Responded",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    icon: CheckCircle,
  },
  closed: {
    label: "Closed",
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    icon: CheckCircle,
  },
}

export default function CustomerQuotesPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: quotes, isLoading } = useQuotes()

  const filtered = (quotes ?? []).filter((q) => {
    const matchesStatus =
      statusFilter === "all" || q.status === statusFilter
    const matchesSearch =
      !search || q.product_name.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Quotes</h1>
          <p className="text-muted-foreground">
            Track the status of your quote requests.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Under Review</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-4 size-10 text-muted-foreground" />
              <h3 className="mb-1.5 text-lg font-semibold">
                No quote requests yet
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Request a quote from any product page to get custom pricing for
                bulk orders.
              </p>
              <Button asChild>
                <Link href="/products">Browse Products</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quote cards */}
        {!isLoading && filtered.length > 0 && (
          <div className="space-y-4">
            {paginateArray(filtered, page, pageSize).map((quote, index) => {
              const config = statusConfig[quote.status] || statusConfig.pending
              const StatusIcon = config.icon

              return (
                <m.div
                  key={quote.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="pt-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        {/* Left - Product info */}
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {quote.product_name}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span>Qty: {quote.quantity}</span>
                              {quote.packaging_size && (
                                <>
                                  <span>-</span>
                                  <span>{quote.packaging_size}</span>
                                </>
                              )}
                            </div>
                            {quote.delivery_location && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Delivery: {quote.delivery_location}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right - Status and date */}
                        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                          <Badge variant="outline" className={config.color}>
                            <StatusIcon className="mr-1.5 h-3 w-3" />
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(quote.created_at).toLocaleDateString(
                              "en-AU",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Message if exists */}
                      {quote.message && (
                        <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {quote.message}
                          </p>
                        </div>
                      )}

                      {/* Admin notes if responded */}
                      {quote.admin_notes && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div>
                            <p className="text-xs font-medium text-primary">
                              Response from our team
                            </p>
                            <p className="mt-1 text-sm">{quote.admin_notes}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </m.div>
              )
            })}

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </LazyMotion>
  )
}
