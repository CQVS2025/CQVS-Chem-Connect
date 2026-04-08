"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  useProducts,
  useDeleteProduct,
} from "@/lib/hooks/use-products"
import { products as staticProducts, categories } from "@/lib/data/products"
import type { ProductPriceType } from "@/lib/supabase/types"
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

export default function AdminProductsPage() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: apiProducts, isLoading } = useProducts()
  const deleteProduct = useDeleteProduct()

  // Normalize products - API returns snake_case, static uses camelCase
  const allProducts = useMemo(() => {
    if (apiProducts) {
      return apiProducts.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        unit: p.unit,
        category: p.category,
        classification: p.classification,
        stockQty: p.stock_qty,
        inStock: p.in_stock,
        priceType: (p.price_type ?? "per_litre") as ProductPriceType,
      }))
    }
    return staticProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      unit: p.unit,
      category: p.category,
      classification: p.classification,
      stockQty: p.stockQty,
      inStock: p.inStock,
      priceType: "per_litre" as ProductPriceType,
    }))
  }, [apiProducts])

  const filtered = allProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      categoryFilter === "All" || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  function handleDelete(id: string) {
    deleteProduct.mutate(id, {
      onSuccess: () => {
        toast.success("Product deleted")
        setDeleteConfirm(null)
      },
      onError: () =>
        toast.error(
          "Unable to delete product. It may be linked to existing orders.",
        ),
    })
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalogue.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Products ({filtered.length})</CardTitle>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginateArray(filtered, page, pageSize).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${product.price.toFixed(2)}/{product.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.stockQty}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            product.classification.startsWith("DG")
                              ? "border-red-500/20 bg-red-500/10 text-red-500"
                              : "border-green-500/20 bg-green-500/10 text-green-500"
                          }
                        >
                          {product.classification}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {product.inStock ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          >
                            In Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-red-500/20 bg-red-500/10 text-red-500"
                          >
                            Out of Stock
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Link>
                          </Button>

                          {deleteConfirm === product.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleDelete(product.id)}
                              >
                                Confirm
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setDeleteConfirm(product.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No products found.
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
      </div>
    </PageTransition>
  )
}
