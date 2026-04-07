"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Pencil, Save, Warehouse as WarehouseIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useContainerCosts,
  useUpsertContainerCost,
} from "@/lib/hooks/use-warehouses"
import { usePackagingSizes } from "@/lib/hooks/use-packaging-sizes"
import type { Warehouse } from "@/lib/supabase/types"

const AU_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]

type Tab = "warehouses" | "containers"

export default function AdminWarehousesPage() {
  const [tab, setTab] = useState<Tab>("warehouses")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Shipping &amp; Warehouses
        </h1>
        <p className="text-muted-foreground">
          Manage warehouse locations and per-warehouse container costs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("warehouses")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "warehouses"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Warehouses
        </button>
        <button
          type="button"
          onClick={() => setTab("containers")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "containers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Container Costs
        </button>
      </div>

      {tab === "warehouses" && <WarehousesTab />}
      {tab === "containers" && <ContainerCostsTab />}
    </div>
  )
}

// ----------------------------------------------------------------
// Warehouses Tab
// ----------------------------------------------------------------
function WarehousesTab() {
  const { data: warehouses = [], isLoading } = useWarehouses()
  const createWarehouse = useCreateWarehouse()
  const updateWarehouse = useUpdateWarehouse()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_postcode: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    xero_contact_id: "",
    is_active: true,
    sort_order: 0,
  })

  function openAdd() {
    setEditingId(null)
    setForm({
      name: "",
      address_street: "",
      address_city: "",
      address_state: "",
      address_postcode: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      xero_contact_id: "",
      is_active: true,
      sort_order: warehouses.length * 10 + 10,
    })
    setDialogOpen(true)
  }

  function openEdit(w: Warehouse) {
    setEditingId(w.id)
    setForm({
      name: w.name,
      address_street: w.address_street,
      address_city: w.address_city,
      address_state: w.address_state,
      address_postcode: w.address_postcode,
      contact_name: w.contact_name ?? "",
      contact_email: w.contact_email ?? "",
      contact_phone: w.contact_phone ?? "",
      xero_contact_id: w.xero_contact_id ?? "",
      is_active: w.is_active,
      sort_order: w.sort_order,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    const payload = {
      ...form,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      xero_contact_id: form.xero_contact_id || null,
    }

    try {
      if (editingId) {
        await updateWarehouse.mutateAsync({ id: editingId, ...payload })
        toast.success("Warehouse updated")
      } else {
        await createWarehouse.mutateAsync(payload)
        toast.success("Warehouse added")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Failed to save warehouse")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Warehouses</CardTitle>
          <CardDescription>
            Pickup locations used for shipping calculations and Xero POs.
          </CardDescription>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Warehouse
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No warehouses configured.
                  </TableCell>
                </TableRow>
              )}
              {warehouses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[w.address_street, w.address_city, w.address_postcode]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </TableCell>
                  <TableCell>{w.address_state}</TableCell>
                  <TableCell>
                    {w.is_active ? (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(w)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Warehouse" : "Add Warehouse"}
              </DialogTitle>
              <DialogDescription>
                Full street address is required for accurate shipping quotes.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ChemBuild Industries"
                />
              </div>
              <div className="grid gap-2">
                <Label>Street Address</Label>
                <Input
                  value={form.address_street}
                  onChange={(e) =>
                    setForm({ ...form, address_street: e.target.value })
                  }
                  placeholder="42 Industrial Drive"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>City</Label>
                  <Input
                    value={form.address_city}
                    onChange={(e) =>
                      setForm({ ...form, address_city: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>State</Label>
                  <Select
                    value={form.address_state}
                    onValueChange={(v) =>
                      setForm({ ...form, address_state: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      {AU_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Postcode</Label>
                  <Input
                    value={form.address_postcode}
                    onChange={(e) =>
                      setForm({ ...form, address_postcode: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={form.contact_name}
                    onChange={(e) =>
                      setForm({ ...form, contact_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contact Phone</Label>
                  <Input
                    value={form.contact_phone}
                    onChange={(e) =>
                      setForm({ ...form, contact_phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) =>
                    setForm({ ...form, contact_email: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>
                  Xero Contact ID{" "}
                  <span className="text-xs text-muted-foreground">
                    (for warehouse POs in Xero)
                  </span>
                </Label>
                <Input
                  value={form.xero_contact_id}
                  onChange={(e) =>
                    setForm({ ...form, xero_contact_id: e.target.value })
                  }
                  placeholder="e.g. uuid from Xero"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sort_order: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, is_active: !form.is_active })
                    }
                    className={`flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium ${
                      form.is_active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                        : "border-red-500/30 bg-red-500/10 text-red-500"
                    }`}
                  >
                    {form.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createWarehouse.isPending || updateWarehouse.isPending}
              >
                {createWarehouse.isPending || updateWarehouse.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------
// Container Costs Tab
// ----------------------------------------------------------------
function ContainerCostsTab() {
  const { data: warehouses = [] } = useWarehouses()
  const { data: packagingSizes = [] } = usePackagingSizes()
  const { data: containerCosts = [], isLoading } = useContainerCosts()
  const upsertContainerCost = useUpsertContainerCost()

  // Build a map: { "warehouseId:packagingSizeId" -> cost }
  const costMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const cc of containerCosts) {
      map.set(`${cc.warehouse_id}:${cc.packaging_size_id}`, Number(cc.cost))
    }
    return map
  }, [containerCosts])

  // Local edited values
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  function key(warehouseId: string, packagingSizeId: string) {
    return `${warehouseId}:${packagingSizeId}`
  }

  function getDisplayValue(warehouseId: string, packagingSizeId: string): string {
    const k = key(warehouseId, packagingSizeId)
    if (edits[k] !== undefined) return edits[k]
    const existing = costMap.get(k)
    return existing != null ? existing.toString() : ""
  }

  async function handleSave(warehouseId: string, packagingSizeId: string) {
    const k = key(warehouseId, packagingSizeId)
    const value = parseFloat(edits[k] ?? getDisplayValue(warehouseId, packagingSizeId))
    if (Number.isNaN(value) || value < 0) {
      toast.error("Enter a valid amount")
      return
    }
    setSavingKey(k)
    try {
      await upsertContainerCost.mutateAsync({
        warehouse_id: warehouseId,
        packaging_size_id: packagingSizeId,
        cost: value,
      })
      // Clear edit so the displayed value comes from the refetched data
      setEdits((prev) => {
        const next = { ...prev }
        delete next[k]
        return next
      })
      toast.success("Saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSavingKey(null)
    }
  }

  if (warehouses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Add a warehouse first.
        </CardContent>
      </Card>
    )
  }

  if (packagingSizes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No packaging sizes configured.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Container Costs</CardTitle>
        <CardDescription>
          Cost of the physical container (drum, IBC, etc.) per warehouse. These
          appear as separate line items at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Packaging Size</TableHead>
                  {warehouses
                    .filter((w) => w.is_active)
                    .map((w) => (
                      <TableHead key={w.id} className="text-center">
                        {w.name}
                      </TableHead>
                    ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {packagingSizes.map((ps) => (
                  <TableRow key={ps.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {ps.name}
                      </div>
                    </TableCell>
                    {warehouses
                      .filter((w) => w.is_active)
                      .map((w) => {
                        const k = key(w.id, ps.id)
                        return (
                          <TableCell key={w.id}>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={getDisplayValue(w.id, ps.id)}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [k]: e.target.value,
                                  }))
                                }
                                className="h-9 w-20"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                disabled={savingKey === k}
                                onClick={() => handleSave(w.id, ps.id)}
                              >
                                {savingKey === k ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        )
                      })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
