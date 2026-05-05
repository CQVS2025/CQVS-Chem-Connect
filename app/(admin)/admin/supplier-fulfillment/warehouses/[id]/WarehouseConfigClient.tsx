"use client"

// Per-warehouse admin: products, rate sheets, supplier users.
// All three needed to onboard a supplier end-to-end - UI-only, no SQL.

import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Save,
  Pencil,
  ExternalLink,
  Mail,
  Settings2,
  PackageOpen,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"

import { BulkUploadPanel } from "./BulkUploadPanel"

// ============================================================
// Types
// ============================================================
interface RateSheet {
  id: string
  warehouse_id: string
  name: string
  unit_type: string
  origin_postcode: string | null
  is_active: boolean
  min_charge: number | null
  out_of_range_behavior: string
  supplier_rate_sheet_brackets: Bracket[]
}
interface Bracket {
  id?: string
  distance_from_km: number
  distance_to_km: number
  rate: number
}
interface WarehouseUser {
  id: string
  user_id: string
  receives_po_emails: boolean
  can_update_orders: boolean
  is_primary_contact: boolean
  profiles: {
    email: string
    contact_name: string | null
    role: string
  } | null
}

const UNIT_TYPES = [
  { value: "per_litre", label: "Per litre × distance" },
  { value: "flat_per_consignment", label: "Flat per consignment" },
  { value: "per_kg", label: "Per kg" },
  { value: "per_pallet", label: "Per pallet" },
  { value: "per_zone", label: "Per zone" },
] as const

function unitTypeLabel(value: string): string {
  return UNIT_TYPES.find((u) => u.value === value)?.label ?? value
}

// ============================================================
// Top-level tabs
// ============================================================
export function WarehouseConfigClient({
  warehouseId,
}: {
  warehouseId: string
}) {
  return (
    <Tabs defaultValue="products" className="w-full">
      <TabsList>
        <TabsTrigger value="products">
          <PackageOpen className="mr-1.5 h-3.5 w-3.5" />
          Products
        </TabsTrigger>
        <TabsTrigger value="sheets">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Rate sheets
        </TabsTrigger>
        <TabsTrigger value="users">
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Supplier users
        </TabsTrigger>
      </TabsList>
      <TabsContent value="products" className="mt-4">
        <ProductsTab warehouseId={warehouseId} />
      </TabsContent>
      <TabsContent value="sheets" className="mt-4">
        <RateSheetsTab warehouseId={warehouseId} />
      </TabsContent>
      <TabsContent value="users" className="mt-4">
        <UsersTab warehouseId={warehouseId} />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Products tab
// ============================================================
function ProductsTab({ warehouseId }: { warehouseId: string }) {
  interface ProductRow {
    id: string
    name: string
    slug: string
    packaging_prices: Array<{
      packaging_size_id: string
      packaging_size: { id: string; name: string }
    }>
  }
  interface MappingRow {
    id: string
    product_id: string
    packaging_size_id: string | null
    product?: { id: string; name: string; slug: string }
    packaging_size?: { id: string; name: string } | null
  }

  const [products, setProducts] = useState<ProductRow[]>([])
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draftProduct, setDraftProduct] = useState("")
  const [draftSizeId, setDraftSizeId] = useState<string>("__all__")
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    Promise.all([
      fetch("/api/products?includePricing=true&include_hidden=true").then((r) => r.json()),
      fetch(`/api/product-warehouses?warehouse_id=${warehouseId}`).then((r) => r.json()),
    ])
      .then(([prodData, mapData]) => {
        setProducts(Array.isArray(prodData) ? (prodData as ProductRow[]) : [])
        setMappings(Array.isArray(mapData) ? (mapData as MappingRow[]) : [])
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId])

  const selectedProduct = products.find((p) => p.id === draftProduct)
  const sizeOptions = selectedProduct?.packaging_prices ?? []

  const add = async () => {
    if (!draftProduct) return
    setAdding(true)
    try {
      const res = await fetch("/api/product-warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: draftProduct,
          warehouse_id: warehouseId,
          packaging_size_id: draftSizeId === "__all__" ? null : draftSizeId,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to add product")
      }
      toast.success("Product added to this supplier warehouse")
      setDraftProduct("")
      setDraftSizeId("__all__")
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add product")
    } finally {
      setAdding(false)
    }
  }

  const remove = async (m: MappingRow) => {
    setRemovingId(m.id)
    try {
      const params = new URLSearchParams({
        product_id: m.product_id,
        warehouse_id: warehouseId,
      })
      if (m.packaging_size_id) params.set("packaging_size_id", m.packaging_size_id)
      await fetch(`/api/product-warehouses?${params.toString()}`, { method: "DELETE" })
      toast.success("Product removed")
      reload()
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pick the products this supplier fulfils</CardTitle>
          <CardDescription>
            Products listed here are routed to this warehouse at checkout. MacShip is skipped, freight is quoted from this warehouse&rsquo;s rate sheets, and orders land on the supplier dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select
                value={draftProduct}
                onValueChange={(v) => {
                  setDraftProduct(v)
                  setDraftSizeId("__all__")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Packaging</Label>
              <Select
                value={draftSizeId}
                onValueChange={setDraftSizeId}
                disabled={!draftProduct}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All packaging sizes</SelectItem>
                  {sizeOptions.map((pp) => (
                    <SelectItem key={pp.packaging_size.id} value={pp.packaging_size.id}>
                      Only: {pp.packaging_size.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={add} disabled={!draftProduct || adding}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add product
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapped products</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${mappings.length} product${mappings.length === 1 ? "" : "s"} fulfilled from this warehouse.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products mapped yet. Add one above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Packaging scope</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.product?.name ?? m.product_id}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.packaging_size_id
                        ? `Only: ${m.packaging_size?.name ?? "(specific size)"}`
                        : "All packaging sizes"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/admin/supplier-fulfillment/products?product=${m.product_id}`}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />
                            Configure
                          </a>
                        </Button>
                        <RemoveProductDialog
                          productName={m.product?.name ?? "this product"}
                          isRemoving={removingId === m.id}
                          onConfirm={() => remove(m)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RemoveProductDialog({
  productName,
  isRemoving,
  onConfirm,
}: {
  productName: string
  isRemoving: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={isRemoving}>
          {isRemoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {productName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This stops new orders for this product from being routed to this supplier warehouse.
            Existing orders are unaffected. You can re-add the mapping any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// Rate sheets tab
// ============================================================
function RateSheetsTab({ warehouseId }: { warehouseId: string }) {
  const [sheets, setSheets] = useState<RateSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [unitType, setUnitType] = useState("per_litre")
  const [originPostcode, setOriginPostcode] = useState("")

  const reload = () => {
    setLoading(true)
    fetch(`/api/admin/rate-sheets?warehouse_id=${warehouseId}`)
      .then((r) => r.json())
      .then((d) => setSheets(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId])

  const create = async () => {
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch("/api/admin/rate-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: warehouseId,
          name,
          unit_type: unitType,
          origin_postcode: originPostcode || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to create rate sheet")
      }
      toast.success(`Rate sheet "${name}" created`)
      setName("")
      setOriginPostcode("")
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create rate sheet")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <BulkUploadPanel warehouseId={warehouseId} onImported={reload} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New rate sheet (manual)</CardTitle>
          <CardDescription>
            For one-off rate sheets. For full freight matrices, use bulk upload above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-end gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. AdBlue Bulk Post-14Jul25"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit type</Label>
              <Select value={unitType} onValueChange={setUnitType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origin postcode</Label>
              <Input
                placeholder="Optional"
                value={originPostcode}
                onChange={(e) => setOriginPostcode(e.target.value)}
              />
            </div>
            <div className="sm:col-span-4">
              <Button onClick={create} disabled={!name || creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create rate sheet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading rate sheets…
          </CardContent>
        </Card>
      ) : sheets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No rate sheets yet. Use bulk upload (above) or create one manually.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sheets.map((s) => (
            <RateSheetCard key={s.id} sheet={s} reload={reload} />
          ))}
        </div>
      )}
    </div>
  )
}

function RateSheetCard({
  sheet,
  reload,
}: {
  sheet: RateSheet
  reload: () => void
}) {
  const [open, setOpen] = useState(false)
  const [brackets, setBrackets] = useState<Bracket[]>(
    sheet.supplier_rate_sheet_brackets ?? [],
  )
  const [originalBrackets] = useState<Bracket[]>(
    sheet.supplier_rate_sheet_brackets ?? [],
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const dirty = useMemo(() => {
    if (brackets.length !== originalBrackets.length) return true
    return brackets.some((b, i) => {
      const o = originalBrackets[i]
      return (
        !o ||
        b.distance_from_km !== o.distance_from_km ||
        b.distance_to_km !== o.distance_to_km ||
        b.rate !== o.rate
      )
    })
  }, [brackets, originalBrackets])

  const summary = useMemo(() => {
    if (brackets.length === 0) return null
    const minKm = Math.min(...brackets.map((b) => b.distance_from_km))
    const maxKm = Math.max(...brackets.map((b) => b.distance_to_km))
    const minRate = Math.min(...brackets.map((b) => b.rate))
    const maxRate = Math.max(...brackets.map((b) => b.rate))
    return {
      count: brackets.length,
      minKm,
      maxKm,
      minRate,
      maxRate,
    }
  }, [brackets])

  const paginated = useMemo(
    () => paginateArray(brackets, page, pageSize),
    [brackets, page, pageSize],
  )
  // Compute the offset so input handlers receive the underlying index.
  const offset = (page - 1) * pageSize

  const updateBracket = (idx: number, patch: Partial<Bracket>) => {
    setBrackets((bs) => bs.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }
  const addBracket = () => {
    const sorted = [...brackets].sort((a, b) => a.distance_to_km - b.distance_to_km)
    const last = sorted[sorted.length - 1]
    setBrackets((bs) => [
      ...bs,
      {
        distance_from_km: last ? last.distance_to_km : 0,
        distance_to_km: last ? last.distance_to_km + 100 : 100,
        rate: 0,
      },
    ])
    // Jump to the page containing the new row.
    const newCount = brackets.length + 1
    setPage(Math.ceil(newCount / pageSize))
  }
  const removeBracket = (idx: number) =>
    setBrackets((bs) => bs.filter((_, i) => i !== idx))

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/rate-sheets/${sheet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brackets }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to save brackets")
      }
      toast.success(`Saved ${brackets.length} bracket${brackets.length === 1 ? "" : "s"}`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save brackets")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/admin/rate-sheets/${sheet.id}`, { method: "DELETE" })
      toast.success(`Rate sheet "${sheet.name}" deleted`)
      reload()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="icon" className="-mt-1 h-7 w-7" tabIndex={-1}>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div>
              <CardTitle className="text-base">{sheet.name}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {unitTypeLabel(sheet.unit_type)}
                </Badge>
                <span className="text-xs">
                  origin {sheet.origin_postcode ?? "(uses warehouse postcode)"}
                </span>
                {!sheet.is_active && (
                  <Badge variant="outline" className="bg-muted text-xs">
                    Inactive
                  </Badge>
                )}
                {summary && (
                  <span className="text-xs text-muted-foreground">
                    · {summary.count} brackets · {summary.minKm}-{summary.maxKm}km
                    · ${summary.minRate.toFixed(2)}-${summary.maxRate.toFixed(2)}
                  </span>
                )}
                {dirty && (
                  <Badge className="bg-amber-500/10 text-xs text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
                    Unsaved changes
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <DeleteRateSheetDialog
              sheetName={sheet.name}
              dirty={dirty}
              isDeleting={deleting}
              onConfirm={remove}
            />
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">From km</TableHead>
                  <TableHead className="w-[120px]">To km</TableHead>
                  <TableHead className="w-[160px]">Rate</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      No brackets yet. Click <em>Add bracket</em> to start.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((b, i) => {
                    const idx = offset + i
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Input
                            type="number"
                            value={b.distance_from_km}
                            onChange={(e) =>
                              updateBracket(idx, {
                                distance_from_km: Number(e.target.value),
                              })
                            }
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={b.distance_to_km}
                            onChange={(e) =>
                              updateBracket(idx, {
                                distance_to_km: Number(e.target.value),
                              })
                            }
                            className="h-8 w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={b.rate}
                            onChange={(e) =>
                              updateBracket(idx, { rate: Number(e.target.value) })
                            }
                            className="h-8 w-32"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeBracket(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {brackets.length > pageSize && (
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={brackets.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={addBracket}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add bracket
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {dirty ? "Save brackets" : "Saved"}
            </Button>
            {dirty && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                You have unsaved changes.
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function DeleteRateSheetDialog({
  sheetName,
  dirty,
  isDeleting,
  onConfirm,
}: {
  sheetName: string
  dirty: boolean
  isDeleting: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete rate sheet &ldquo;{sheetName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the rate sheet and all its distance brackets.
            Products mapped to this sheet via per-product setup will lose their
            freight quote and revert to a missing-rate-sheet error at checkout.
            {dirty && (
              <span className="mt-2 block font-medium text-amber-700 dark:text-amber-400">
                You have unsaved bracket changes - they will be discarded.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete rate sheet
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ============================================================
// Supplier users tab
// ============================================================
function UsersTab({ warehouseId }: { warehouseId: string }) {
  const [users, setUsers] = useState<WarehouseUser[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [adding, setAdding] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const reload = () => {
    setLoading(true)
    fetch(`/api/admin/warehouse-users?warehouse_id=${warehouseId}`)
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId])

  const add = async () => {
    if (!email.trim()) return
    setAdding(true)
    try {
      const res = await fetch("/api/admin/warehouse-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: warehouseId,
          email: email.trim(),
          contact_name: contactName.trim() || null,
          phone: phone.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to add supplier user")
      }
      const j = (await res.json()) as {
        created_new_account: boolean
        invite_sent: boolean
        invite_error: string | null
        linked_existing_role: "supplier" | "admin" | null
        email: string
      }
      if (j.created_new_account) {
        if (j.invite_sent) {
          toast.success(
            `New supplier account created. ${j.email} has been emailed a link to set their password.`,
            { duration: 8000 },
          )
        } else {
          toast.warning(
            `Supplier account created for ${j.email}, but the invite email couldn't be sent${j.invite_error ? ` (${j.invite_error})` : ""}. Share a password-reset link manually from the admin Users page.`,
            { duration: 12000 },
          )
        }
      } else if (j.linked_existing_role === "supplier") {
        if (j.invite_sent) {
          toast.success(
            `${j.email} re-onboarded - a fresh set-password email has been sent.`,
            { duration: 8000 },
          )
        } else if (j.invite_error) {
          toast.warning(
            `${j.email} linked to this warehouse. Tried to re-send the set-password email but it failed (${j.invite_error}). Click the envelope icon next to their row to retry.`,
            { duration: 12000 },
          )
        } else {
          toast.success(
            `${j.email} is an existing supplier - linked to this warehouse.`,
          )
        }
      } else if (j.linked_existing_role === "admin") {
        toast.success(
          `${j.email} (admin) linked to this warehouse for ops access.`,
        )
      } else {
        toast.success(`${j.email} linked to this warehouse.`)
      }
      setEmail("")
      setContactName("")
      setPhone("")
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add user")
    } finally {
      setAdding(false)
    }
  }

  const remove = async (id: string, displayName: string) => {
    try {
      await fetch(`/api/admin/warehouse-users?id=${id}`, { method: "DELETE" })
      toast.success(`Removed ${displayName}`)
      reload()
    } catch {
      toast.error("Failed to remove user")
    }
  }

  const paginated = useMemo(
    () => paginateArray(users, page, pageSize),
    [users, page, pageSize],
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add supplier user</CardTitle>
          <CardDescription>
            Creates a brand-new supplier account scoped to this warehouse and
            emails the supplier a link to set their password. Buyer accounts
            cannot be reused - supplier accounts are always separate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier-email"
                type="email"
                placeholder="dispatch@supplier.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <p className="text-xs text-muted-foreground">
                Must be a dedicated supplier business email - not an existing
                buyer's email.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">Contact name</Label>
              <Input
                id="supplier-name"
                placeholder="e.g. Sarah at AdBlue Dispatch"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-phone">Phone (optional)</Label>
              <Input
                id="supplier-phone"
                type="tel"
                placeholder="+61 4xx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={add}
                disabled={!email.trim() || adding}
                className="w-full sm:w-auto"
              >
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create supplier user
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users with access</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${users.length} user${users.length === 1 ? "" : "s"} can sign in to the supplier dashboard.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No supplier users yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name / email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Receives POs</TableHead>
                    <TableHead>Can update orders</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">
                          {u.profiles?.contact_name ?? u.profiles?.email ?? u.user_id}
                          {u.is_primary_contact && (
                            <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>
                          )}
                        </div>
                        {u.profiles?.contact_name && u.profiles?.email && (
                          <div className="text-xs text-muted-foreground">{u.profiles.email}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {u.profiles?.role ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.receives_po_emails ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 text-xs">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.can_update_orders ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 text-xs">Yes</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">No (read-only)</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ResendInviteButton
                            warehouseUserId={u.id}
                            email={u.profiles?.email ?? null}
                          />
                          <RemoveUserDialog
                            displayName={u.profiles?.contact_name ?? u.profiles?.email ?? u.user_id}
                            onConfirm={() =>
                              remove(
                                u.id,
                                u.profiles?.contact_name ?? u.profiles?.email ?? u.user_id,
                              )
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {users.length > pageSize && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={users.length}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => {
                    setPageSize(s)
                    setPage(1)
                  }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ResendInviteButton({
  warehouseUserId,
  email,
}: {
  warehouseUserId: string
  email: string | null
}) {
  const [sending, setSending] = useState(false)
  const send = async () => {
    setSending(true)
    try {
      const res = await fetch(
        `/api/admin/warehouse-users/${warehouseUserId}/resend-invite`,
        { method: "POST" },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to resend invite")
      }
      toast.success(
        email
          ? `Set-password email re-sent to ${email}.`
          : "Set-password email re-sent.",
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invite")
    } finally {
      setSending(false)
    }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          title="Resend set-password email"
          disabled={sending}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Resend set-password email{email ? ` to ${email}` : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Generates a fresh one-time password-reset link and emails it. Any
            previous link still pending will keep working until clicked, but
            we recommend asking the supplier to use only the latest one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={send}>Resend invite</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RemoveUserDialog({
  displayName,
  onConfirm,
}: {
  displayName: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {displayName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will lose access to the supplier dashboard for this warehouse
            and stop receiving PO emails. Their Chem Connect account remains
            active. You can re-add them any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// suppress unused-import warning for icons used only conditionally
void Pencil
