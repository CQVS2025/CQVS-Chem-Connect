"use client"

// Supplier-side rate-matrix editor.
//
// Suppliers can create, edit, and delete their own rate sheets and
// brackets here. The change is the source of truth for future quotes,
// but does NOT retroactively affect in-flight orders - those are locked
// to their freight_quote_snapshot at order-creation time.
//
// UI mirrors the admin warehouse-config page (collapsible card per
// rate sheet, inline manual create, bulk-upload panel, dirty-state
// indicator, paginated bracket editor).

import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
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
import {
  TablePagination,
  paginateArray,
} from "@/components/shared/table-pagination"
import { BulkUploadPanel } from "@/app/(admin)/admin/supplier-fulfillment/warehouses/[id]/BulkUploadPanel"

interface Warehouse {
  id: string
  name: string
  is_supplier_managed: boolean | null
}

interface Bracket {
  id?: string
  distance_from_km: number
  distance_to_km: number
  rate: number
}

interface RateSheet {
  id: string
  warehouse_id: string
  name: string
  unit_type: string
  origin_postcode: string | null
  is_active: boolean
  min_charge: number | null
  out_of_range_behavior: string
  notes: string | null
  supplier_rate_sheet_brackets: Bracket[]
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

export default function FreightMatrixClient({
  warehouses,
  canUpdateWarehouseIds,
}: {
  warehouses: Warehouse[]
  canUpdateWarehouseIds: string[]
}) {
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0].id)
  const canEdit = canUpdateWarehouseIds.includes(warehouseId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Freight Matrix</h1>
        <p className="text-sm text-muted-foreground">
          Maintain your own freight rate sheets. Changes apply only to{" "}
          <strong>future</strong> orders - already-placed orders are locked to
          the rate that was in effect when the buyer paid.
        </p>
      </div>

      {warehouses.length > 1 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <RateSheetsList warehouseId={warehouseId} canEdit={canEdit} />
    </div>
  )
}

function RateSheetsList({
  warehouseId,
  canEdit,
}: {
  warehouseId: string
  canEdit: boolean
}) {
  const [sheets, setSheets] = useState<RateSheet[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [unitType, setUnitType] = useState("per_litre")
  const [originPostcode, setOriginPostcode] = useState("")

  const reload = () => {
    setLoading(true)
    fetch(`/api/supplier/rate-sheets?warehouse_id=${warehouseId}`)
      .then((r) => r.json())
      .then((d) => setSheets(Array.isArray(d) ? (d as RateSheet[]) : []))
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
      const res = await fetch("/api/supplier/rate-sheets", {
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
      {canEdit && (
        <BulkUploadPanel
          warehouseId={warehouseId}
          onImported={reload}
          importEndpoint="/api/supplier/rate-sheets/bulk-import"
          templateEndpoint="/api/supplier/rate-sheets/template"
          helperText="Download the blank template, fill in your distance brackets and rate columns, then upload it back here."
        />
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New rate sheet (manual)</CardTitle>
            <CardDescription>
              For one-off rate sheets. For full freight matrices, use bulk
              upload above.
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
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create rate sheet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading rate sheets…
          </CardContent>
        </Card>
      ) : sheets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No rate sheets yet for this warehouse.
            {canEdit ? " Use bulk upload (above) or create one manually." : ""}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sheets.map((s) => (
            <RateSheetCard
              key={s.id}
              sheet={s}
              canEdit={canEdit}
              reload={reload}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RateSheetCard({
  sheet,
  canEdit,
  reload,
}: {
  sheet: RateSheet
  canEdit: boolean
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
    return { count: brackets.length, minKm, maxKm, minRate, maxRate }
  }, [brackets])

  const paginated = useMemo(
    () => paginateArray(brackets, page, pageSize),
    [brackets, page, pageSize],
  )
  const offset = (page - 1) * pageSize

  const updateBracket = (idx: number, patch: Partial<Bracket>) => {
    setBrackets((bs) => bs.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }
  const addBracket = () => {
    const sorted = [...brackets].sort(
      (a, b) => a.distance_to_km - b.distance_to_km,
    )
    const last = sorted[sorted.length - 1]
    setBrackets((bs) => [
      ...bs,
      {
        distance_from_km: last ? last.distance_to_km : 0,
        distance_to_km: last ? last.distance_to_km + 100 : 100,
        rate: 0,
      },
    ])
    const newCount = brackets.length + 1
    setPage(Math.ceil(newCount / pageSize))
  }
  const removeBracket = (idx: number) =>
    setBrackets((bs) => bs.filter((_, i) => i !== idx))

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/supplier/rate-sheets/${sheet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brackets }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to save brackets")
      }
      toast.success(
        `Saved ${brackets.length} bracket${brackets.length === 1 ? "" : "s"}`,
      )
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
      const res = await fetch(`/api/supplier/rate-sheets/${sheet.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "Failed to delete rate sheet")
      }
      toast.success(`Rate sheet "${sheet.name}" deleted`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rate sheet")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="-mt-1 h-7 w-7"
              tabIndex={-1}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
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
                    · {summary.count} brackets · {summary.minKm}-{summary.maxKm}
                    km · ${summary.minRate.toFixed(2)}-$
                    {summary.maxRate.toFixed(2)}
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
          {canEdit && (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <DeleteRateSheetDialog
                sheetName={sheet.name}
                dirty={dirty}
                isDeleting={deleting}
                onConfirm={remove}
              />
            </div>
          )}
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
                  {canEdit && (
                    <TableHead className="w-[80px] text-right">
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 4 : 3}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No brackets yet.
                      {canEdit ? " Click Add bracket to start." : ""}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((b, i) => {
                    const idx = offset + i
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          {canEdit ? (
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
                          ) : (
                            <span className="text-sm">{b.distance_from_km}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
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
                          ) : (
                            <span className="text-sm">{b.distance_to_km}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Input
                              type="number"
                              step="0.0001"
                              value={b.rate}
                              onChange={(e) =>
                                updateBracket(idx, {
                                  rate: Number(e.target.value),
                                })
                              }
                              className="h-8 w-32"
                            />
                          ) : (
                            <span className="text-sm">{b.rate}</span>
                          )}
                        </TableCell>
                        {canEdit && (
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
                        )}
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

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={addBracket}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add bracket
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                {saving ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3.5 w-3.5" />
                )}
                {dirty ? "Save brackets" : "Saved"}
              </Button>
              {dirty && (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  You have unsaved changes.
                </span>
              )}
            </div>
          )}
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
          {isDeleting ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3.5 w-3.5" />
          )}
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete rate sheet &ldquo;{sheetName}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the rate sheet and all its distance
            brackets. Existing orders are unaffected (they keep their locked
            quote), but new orders for products mapped to this sheet will fail
            to quote until you create a replacement.
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
