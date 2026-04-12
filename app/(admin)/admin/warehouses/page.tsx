"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Pencil, Save, Trash2, Warehouse as WarehouseIcon } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useContainerCosts,
  useUpsertContainerCost,
  useProductWarehouses,
  useAddProductWarehouse,
  useRemoveProductWarehouse,
  useWarehousePricing,
  useUpsertWarehousePricing,
  useProductsWithPackagingSizes,
} from "@/lib/hooks/use-warehouses"
import {
  usePackagingSizes,
  useCreatePackagingSize,
  useUpdatePackagingSize,
  useDeletePackagingSize,
} from "@/lib/hooks/use-packaging-sizes"
import {
  useLeadTimes,
  useUpsertGlobalLeadTime,
  useUpsertWarehouseLeadTime,
  useUpsertProductWarehouseLeadTime,
  useDeleteProductWarehouseLeadTime,
} from "@/lib/hooks/use-lead-times"
import type { Warehouse, PackagingSize } from "@/lib/supabase/types"

const AU_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]

type Tab = "warehouses" | "packaging-sizes" | "containers" | "product-mapping" | "warehouse-pricing" | "lead-times"

export default function AdminWarehousesPage() {
  const [tab, setTab] = useState<Tab>("warehouses")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Shipping &amp; Warehouses
        </h1>
        <p className="text-muted-foreground">
          Manage warehouse locations, packaging sizes, and per-warehouse container costs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border flex-wrap">
        {(
          [
            { id: "warehouses", label: "Warehouses" },
            { id: "packaging-sizes", label: "Packaging Sizes" },
            { id: "containers", label: "Container Costs" },
            { id: "product-mapping", label: "Product Mapping" },
            { id: "warehouse-pricing", label: "Warehouse Pricing" },
            { id: "lead-times", label: "Lead Times" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "warehouses" && <WarehousesTab />}
      {tab === "packaging-sizes" && <PackagingSizesTab />}
      {tab === "containers" && <ContainerCostsTab />}
      {tab === "product-mapping" && <ProductMappingTab />}
      {tab === "warehouse-pricing" && <WarehousePricingTab />}
      {tab === "lead-times" && <LeadTimesTab />}
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
// Packaging Sizes Tab
// ----------------------------------------------------------------
const CONTAINER_TYPES = [
  { value: "drum", label: "Drum" },
  { value: "jerry_can", label: "Jerry Can" },
  { value: "ibc", label: "IBC" },
  { value: "bag", label: "Bag" },
  { value: "other", label: "Other" },
]

function PackagingSizesTab() {
  const { data: sizes = [], isLoading } = usePackagingSizes()
  const createSize = useCreatePackagingSize()
  const updateSize = useUpdatePackagingSize()
  const deleteSize = useDeletePackagingSize()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    volume_litres: "",
    container_type: "drum",
    sort_order: 0,
    is_active: true,
    units_per_pallet: "",
    unit_weight_kg: "",
  })

  function openAdd() {
    setEditingId(null)
    setForm({
      name: "",
      volume_litres: "",
      container_type: "drum",
      sort_order: (sizes.length + 1) * 10,
      is_active: true,
      units_per_pallet: "",
      unit_weight_kg: "",
    })
    setDialogOpen(true)
  }

  function openEdit(s: PackagingSize) {
    setEditingId(s.id)
    setForm({
      name: s.name,
      volume_litres: s.volume_litres != null ? String(s.volume_litres) : "",
      container_type: s.container_type ?? "drum",
      sort_order: s.sort_order,
      is_active: s.is_active,
      units_per_pallet: s.units_per_pallet != null ? String(s.units_per_pallet) : "",
      unit_weight_kg: s.unit_weight_kg != null ? String(s.unit_weight_kg) : "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    const unitsPerPallet =
      form.units_per_pallet !== "" ? parseInt(form.units_per_pallet, 10) : null
    const unitWeightKg =
      form.unit_weight_kg !== "" ? parseFloat(form.unit_weight_kg) : null
    if (unitsPerPallet !== null && (Number.isNaN(unitsPerPallet) || unitsPerPallet < 1)) {
      toast.error("Units per pallet must be a positive integer")
      return
    }
    if (unitWeightKg !== null && (Number.isNaN(unitWeightKg) || unitWeightKg <= 0)) {
      toast.error("Unit weight must be a positive number")
      return
    }
    const payload = {
      name: form.name.trim(),
      volume_litres: form.volume_litres !== "" ? parseFloat(form.volume_litres) : null,
      container_type: form.container_type,
      sort_order: form.sort_order,
      is_active: form.is_active,
      units_per_pallet: unitsPerPallet,
      unit_weight_kg: unitWeightKg,
    }
    try {
      if (editingId) {
        await updateSize.mutateAsync({ id: editingId, ...payload })
        toast.success("Packaging size updated")
      } else {
        await createSize.mutateAsync(payload)
        toast.success("Packaging size added")
      }
      setDialogOpen(false)
    } catch {
      toast.error("Failed to save packaging size")
    }
  }

  async function handleDeactivate(id: string) {
    setDeletingId(id)
    try {
      await deleteSize.mutateAsync(id)
      toast.success("Packaging size deactivated")
    } catch {
      toast.error("Failed to deactivate")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Packaging Sizes</CardTitle>
          <CardDescription>
            Master list of container/packaging options available across all products.
          </CardDescription>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Size
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
                <TableHead>Type</TableHead>
                <TableHead>Volume (L)</TableHead>
                <TableHead>Units / Pallet</TableHead>
                <TableHead>Unit Weight (kg)</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sizes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No packaging sizes configured.
                  </TableCell>
                </TableRow>
              )}
              {sizes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {(s.container_type ?? "").replace("_", " ")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.volume_litres != null ? `${s.volume_litres}L` : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.units_per_pallet ?? (
                      <span className="text-amber-500" title="Not set - Machship quotes will use defaults">
                        not set
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.unit_weight_kg != null ? `${s.unit_weight_kg} kg` : (
                      <span className="text-amber-500" title="Not set - Machship quotes will use defaults">
                        not set
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.sort_order}</TableCell>
                  <TableCell>
                    {s.is_active ? (
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
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {s.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeactivate(s.id)}
                          disabled={deleteSize.isPending}
                        >
                          {deletingId === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Packaging Size" : "Add Packaging Size"}
              </DialogTitle>
              <DialogDescription>
                Sizes appear as selectable options on product pages and in cart.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. 205L Drum, 1000L IBC"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Container Type</Label>
                  <Select
                    value={form.container_type}
                    onValueChange={(v) => setForm({ ...form, container_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAINER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>
                    Volume (litres){" "}
                    <span className="text-xs text-muted-foreground">optional</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.volume_litres}
                    onChange={(e) => setForm({ ...form, volume_litres: e.target.value })}
                    placeholder="e.g. 205"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>
                    Units per Pallet{" "}
                    <span className="text-xs text-muted-foreground">for shipping quotes</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={form.units_per_pallet}
                    onChange={(e) =>
                      setForm({ ...form, units_per_pallet: e.target.value })
                    }
                    placeholder="e.g. 16"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>
                    Unit Weight (kg){" "}
                    <span className="text-xs text-muted-foreground">when filled</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_weight_kg}
                    onChange={(e) =>
                      setForm({ ...form, unit_weight_kg: e.target.value })
                    }
                    placeholder="e.g. 25"
                  />
                </div>
              </div>
              <p className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2 text-xs text-blue-400">
                <strong>Pallet capacity</strong> is used by Machship shipping quotes to consolidate
                multiple units onto shared pallets. E.g. setting <em>Units per Pallet = 16</em> for a
                20L Drum means 2 drums get quoted as 1 pallet (50 kg) instead of 2 separate pallets.
                Leave blank to use the system default for that size.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
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
                disabled={createSize.isPending || updateSize.isPending}
              >
                {createSize.isPending || updateSize.isPending ? (
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
                              <span className="text-xs text-muted-foreground">AUD</span>
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

// ----------------------------------------------------------------
// Product Mapping Tab
// ----------------------------------------------------------------
function ProductMappingTab() {
  const { data: warehouses = [] } = useWarehouses()
  const { data: allProducts = [], isLoading: loadingProducts } = useProductsWithPackagingSizes()
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")

  const { data: mappings = [], isLoading: loadingMappings } = useProductWarehouses({
    warehouseId: selectedWarehouseId || undefined,
  })

  const addMapping = useAddProductWarehouse()
  const removeMapping = useRemoveProductWarehouse()

  // Build a set of composite keys "product_id:packaging_size_id" for fast lookup.
  // A null packaging_size_id row means "all sizes" for that product.
  const mappedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const m of mappings) {
      if (m.packaging_size_id === null) {
        // "All sizes" legacy mapping — key as "product_id:null"
        keys.add(`${m.product_id}:null`)
      } else {
        keys.add(`${m.product_id}:${m.packaging_size_id}`)
      }
    }
    return keys
  }, [mappings])

  const isBusy = addMapping.isPending || removeMapping.isPending

  async function handleToggleSize(
    productId: string,
    packagingSizeId: string,
    isCurrentlyMapped: boolean,
  ) {
    if (!selectedWarehouseId) return
    try {
      if (isCurrentlyMapped) {
        await removeMapping.mutateAsync({
          productId,
          warehouseId: selectedWarehouseId,
          packagingSizeId,
        })
      } else {
        await addMapping.mutateAsync({
          product_id: productId,
          warehouse_id: selectedWarehouseId,
          packaging_size_id: packagingSizeId,
        })
      }
    } catch {
      toast.error("Failed to update mapping")
    }
  }

  async function handleToggleLegacy(productId: string, isCurrentlyMapped: boolean) {
    if (!selectedWarehouseId) return
    try {
      if (isCurrentlyMapped) {
        // Remove the "all sizes" mapping (packaging_size_id = null)
        await removeMapping.mutateAsync({
          productId,
          warehouseId: selectedWarehouseId,
          packagingSizeId: null,
        })
      } else {
        await addMapping.mutateAsync({
          product_id: productId,
          warehouse_id: selectedWarehouseId,
          packaging_size_id: null,
        })
      }
    } catch {
      toast.error("Failed to update mapping")
    }
  }

  const isLoading = loadingProducts || loadingMappings

  // Count distinct mapped products for the summary line
  const mappedProductCount = useMemo(() => {
    return new Set(mappings.map((m) => m.product_id)).size
  }, [mappings])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>Product Mapping</CardTitle>
          <CardDescription>
            Configure which products (and specific packaging sizes) are available at each warehouse.
            This controls MacShip warehouse selection. Products with configured pricing sizes are shown
            per-size; others appear as a single row (applies to all sizes).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-72">
            <Select
              value={selectedWarehouseId}
              onValueChange={setSelectedWarehouseId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a warehouse..." />
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
          {selectedWarehouseId && !isLoading && (
            <p className="text-sm text-muted-foreground">
              {mappedProductCount} of {allProducts.length} products with at least one mapping
            </p>
          )}
        </div>

        {!selectedWarehouseId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Select a warehouse above to configure its product availability.
          </p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading products...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Available</TableHead>
                <TableHead>Product / Packaging Size</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Slug</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
              {allProducts.map((product) => {
                const activeSizes = (product.packaging_prices ?? []).filter(
                  (pp) => pp.is_available,
                )

                if (activeSizes.length === 0) {
                  // Legacy: no packaging sizes configured — single "all sizes" row
                  const isMapped = mappedKeys.has(`${product.id}:null`)
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={isMapped}
                          disabled={isBusy}
                          onCheckedChange={() => handleToggleLegacy(product.id, isMapped)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                        <span className="ml-2 text-xs text-muted-foreground">(all sizes)</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.category ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {product.slug}
                      </TableCell>
                    </TableRow>
                  )
                }

                // Product has packaging sizes — show a group header then per-size rows
                return (
                  <>
                    {/* Group header row */}
                    <TableRow key={`${product.id}:header`} className="bg-muted/40">
                      <TableCell />
                      <TableCell
                        colSpan={3}
                        className="py-2 font-semibold text-sm"
                      >
                        {product.name}
                      </TableCell>
                    </TableRow>
                    {/* Per-size rows */}
                    {activeSizes.map((pp) => {
                      const key = `${product.id}:${pp.packaging_size_id}`
                      const isMapped = mappedKeys.has(key)
                      return (
                        <TableRow key={key}>
                          <TableCell className="pl-8">
                            <Checkbox
                              checked={isMapped}
                              disabled={isBusy}
                              onCheckedChange={() =>
                                handleToggleSize(product.id, pp.packaging_size_id, isMapped)
                              }
                            />
                          </TableCell>
                          <TableCell className="pl-8 text-sm">
                            {pp.packaging_size?.name ?? pp.packaging_size_id}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {product.category ?? "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {product.slug}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------
// Warehouse Pricing Tab
// ----------------------------------------------------------------
function WarehousePricingTab() {
  const { data: warehouses = [] } = useWarehouses()
  const { data: packagingSizes = [] } = usePackagingSizes()
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")

  const { data: mappings = [], isLoading: loadingMappings } = useProductWarehouses({
    warehouseId: selectedWarehouseId || undefined,
  })

  const { data: pricingRows = [], isLoading: loadingPricing } = useWarehousePricing({
    warehouseId: selectedWarehouseId || undefined,
  })

  const upsertPricing = useUpsertWarehousePricing()

  // Build a map: { "productId:packagingSizeId" -> cost_price }
  const priceMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of pricingRows) {
      map.set(`${row.product_id}:${row.packaging_size_id}`, Number(row.cost_price))
    }
    return map
  }, [pricingRows])

  const [edits, setEdits] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  function priceKey(productId: string, packagingSizeId: string) {
    return `${productId}:${packagingSizeId}`
  }

  function getDisplayValue(productId: string, packagingSizeId: string): string {
    const k = priceKey(productId, packagingSizeId)
    if (edits[k] !== undefined) return edits[k]
    const existing = priceMap.get(k)
    return existing != null ? existing.toString() : ""
  }

  async function handleSave(productId: string, packagingSizeId: string) {
    if (!selectedWarehouseId) return
    const k = priceKey(productId, packagingSizeId)
    const value = parseFloat(edits[k] ?? getDisplayValue(productId, packagingSizeId))
    if (Number.isNaN(value) || value < 0) {
      toast.error("Enter a valid amount")
      return
    }
    setSavingKey(k)
    try {
      await upsertPricing.mutateAsync({
        warehouse_id: selectedWarehouseId,
        product_id: productId,
        packaging_size_id: packagingSizeId,
        cost_price: value,
      })
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

  const activeSizes = packagingSizes.filter((s) => s.is_active)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warehouse Pricing</CardTitle>
        <CardDescription>
          Configure the cost price (what CQVS pays the warehouse) per product per packaging size. Used for Xero Purchase Orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-72">
          <Select
            value={selectedWarehouseId}
            onValueChange={setSelectedWarehouseId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a warehouse..." />
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

        {!selectedWarehouseId ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Select a warehouse above to configure pricing.
          </p>
        ) : loadingMappings || loadingPricing ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : mappings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No products mapped to this warehouse. Go to the Product Mapping tab to add products first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Packaging Size</TableHead>
                  <TableHead>Cost Price (AUD)</TableHead>
                  <TableHead className="w-16">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.flatMap((mapping) =>
                  activeSizes.map((ps) => {
                    const productId = mapping.product_id
                    const k = priceKey(productId, ps.id)
                    const productName = mapping.product?.name ?? productId
                    return (
                      <TableRow key={k}>
                        <TableCell className="font-medium">{productName}</TableCell>
                        <TableCell className="text-muted-foreground">{ps.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">AUD</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getDisplayValue(productId, ps.id)}
                              onChange={(e) =>
                                setEdits((prev) => ({
                                  ...prev,
                                  [k]: e.target.value,
                                }))
                              }
                              className="h-9 w-28"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            disabled={savingKey === k}
                            onClick={() => handleSave(productId, ps.id)}
                          >
                            {savingKey === k ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  }),
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ----------------------------------------------------------------
// Lead Times Tab
// ----------------------------------------------------------------
function LeadTimesTab() {
  const { data: warehouses = [] } = useWarehouses()
  const { data: leadTimes, isLoading } = useLeadTimes()

  const upsertGlobal = useUpsertGlobalLeadTime()
  const upsertWarehouse = useUpsertWarehouseLeadTime()
  const upsertProductWarehouse = useUpsertProductWarehouseLeadTime()
  const deleteProductWarehouse = useDeleteProductWarehouseLeadTime()

  // --- Global form state ---
  const [globalForm, setGlobalForm] = useState({
    manufacturing_days: "",
    buffer_days: "",
    use_business_days: true,
  })
  const [globalSaving, setGlobalSaving] = useState(false)

  // Sync global form when data loads
  useMemo(() => {
    if (leadTimes?.global) {
      setGlobalForm({
        manufacturing_days: String(leadTimes.global.manufacturing_days),
        buffer_days: String(leadTimes.global.buffer_days),
        use_business_days: leadTimes.global.use_business_days,
      })
    }
  }, [leadTimes?.global])

  async function syncMacShipPickupDates(payload: {
    scope: "global" | "warehouse" | "product_warehouse"
    warehouse_id?: string
    product_id?: string
  }) {
    try {
      const res = await fetch("/api/macship/sync-lead-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        total_affected?: number
        updated?: number
        needs_manual_review?: string[]
        failed?: string[]
      }
      const updated = data.updated ?? 0
      const review = data.needs_manual_review?.length ?? 0
      if ((data.total_affected ?? 0) > 0) {
        toast.success(
          `${updated} order${updated === 1 ? "" : "s"} updated${review > 0 ? `, ${review} need${review === 1 ? "s" : ""} manual review` : ""}`,
        )
      }
    } catch {
      // sync failure is non-blocking
    }
  }

  async function handleSaveGlobal() {
    const mfgDays = parseInt(globalForm.manufacturing_days)
    if (Number.isNaN(mfgDays) || mfgDays < 0) {
      toast.error("Enter valid manufacturing days")
      return
    }
    setGlobalSaving(true)
    try {
      await upsertGlobal.mutateAsync({
        manufacturing_days: mfgDays,
        buffer_days: parseInt(globalForm.buffer_days) || 0,
        use_business_days: globalForm.use_business_days,
      })
      toast.success("Global lead time saved")
      await syncMacShipPickupDates({ scope: "global" })
    } catch {
      toast.error("Failed to save global lead time")
    } finally {
      setGlobalSaving(false)
    }
  }

  // --- Per-warehouse form state ---
  const [warehouseEdits, setWarehouseEdits] = useState<
    Record<string, { manufacturing_days: string; buffer_days: string; use_business_days: boolean; notes: string }>
  >({})
  const [warehouseSaving, setWarehouseSaving] = useState<string | null>(null)

  function getWarehouseRow(warehouseId: string) {
    if (warehouseEdits[warehouseId]) return warehouseEdits[warehouseId]
    const existing = leadTimes?.warehouses.find((w) => w.warehouse_id === warehouseId)
    return {
      manufacturing_days: existing ? String(existing.manufacturing_days) : "",
      buffer_days: existing ? String(existing.buffer_days) : "",
      use_business_days: existing ? existing.use_business_days : true,
      notes: existing?.notes ?? "",
    }
  }

  async function handleSaveWarehouse(warehouseId: string) {
    const row = getWarehouseRow(warehouseId)
    const mfgDays = parseInt(row.manufacturing_days)
    if (Number.isNaN(mfgDays) || mfgDays < 0) {
      toast.error("Enter valid manufacturing days")
      return
    }
    setWarehouseSaving(warehouseId)
    try {
      await upsertWarehouse.mutateAsync({
        warehouse_id: warehouseId,
        manufacturing_days: mfgDays,
        buffer_days: parseInt(row.buffer_days) || 0,
        use_business_days: row.use_business_days,
        notes: row.notes || null,
      })
      setWarehouseEdits((prev) => {
        const next = { ...prev }
        delete next[warehouseId]
        return next
      })
      toast.success("Warehouse lead time saved")
      await syncMacShipPickupDates({ scope: "warehouse", warehouse_id: warehouseId })
    } catch {
      toast.error("Failed to save")
    } finally {
      setWarehouseSaving(null)
    }
  }

  // --- Product override state ---
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")

  const { data: mappings = [], isLoading: loadingMappings } = useProductWarehouses({
    warehouseId: selectedWarehouseId || undefined,
  })

  const [productEdits, setProductEdits] = useState<
    Record<string, { manufacturing_days: string; buffer_days: string; use_business_days: boolean; notes: string }>
  >({})
  const [productSaving, setProductSaving] = useState<string | null>(null)
  const [productDeleting, setProductDeleting] = useState<string | null>(null)

  function productOverrideKey(productId: string, warehouseId: string) {
    return `${productId}:${warehouseId}`
  }

  function getProductRow(productId: string, warehouseId: string) {
    const k = productOverrideKey(productId, warehouseId)
    if (productEdits[k]) return productEdits[k]
    const existing = leadTimes?.productWarehouse.find(
      (pw) => pw.product_id === productId && pw.warehouse_id === warehouseId,
    )
    return {
      manufacturing_days: existing ? String(existing.manufacturing_days) : "",
      buffer_days: existing ? String(existing.buffer_days) : "",
      use_business_days: existing ? existing.use_business_days : true,
      notes: existing?.notes ?? "",
    }
  }

  async function handleSaveProductOverride(productId: string, warehouseId: string) {
    const k = productOverrideKey(productId, warehouseId)
    const row = getProductRow(productId, warehouseId)
    const mfgDays = parseInt(row.manufacturing_days)
    if (Number.isNaN(mfgDays) || mfgDays < 0) {
      toast.error("Enter valid manufacturing days")
      return
    }
    setProductSaving(k)
    try {
      await upsertProductWarehouse.mutateAsync({
        product_id: productId,
        warehouse_id: warehouseId,
        manufacturing_days: mfgDays,
        buffer_days: parseInt(row.buffer_days) || 0,
        use_business_days: row.use_business_days,
        notes: row.notes || null,
      })
      setProductEdits((prev) => {
        const next = { ...prev }
        delete next[k]
        return next
      })
      toast.success("Product override saved")
      await syncMacShipPickupDates({
        scope: "product_warehouse",
        warehouse_id: warehouseId,
        product_id: productId,
      })
    } catch {
      toast.error("Failed to save")
    } finally {
      setProductSaving(null)
    }
  }

  async function handleDeleteProductOverride(productId: string, warehouseId: string) {
    const k = productOverrideKey(productId, warehouseId)
    setProductDeleting(k)
    try {
      await deleteProductWarehouse.mutateAsync({ productId, warehouseId })
      toast.success("Override removed")
      await syncMacShipPickupDates({
        scope: "product_warehouse",
        warehouse_id: warehouseId,
        product_id: productId,
      })
    } catch {
      toast.error("Failed to remove override")
    } finally {
      setProductDeleting(null)
    }
  }

  // Compute effective lead time source label for a product+warehouse
  function getEffectiveSource(productId: string, warehouseId: string): {
    label: string
    variant: "default" | "secondary" | "outline" | "destructive"
    className: string
  } {
    const hasProductOverride = leadTimes?.productWarehouse.some(
      (pw) => pw.product_id === productId && pw.warehouse_id === warehouseId,
    )
    if (hasProductOverride) {
      return { label: "Product override", variant: "default", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" }
    }
    const hasWarehouseDefault = leadTimes?.warehouses.some((w) => w.warehouse_id === warehouseId)
    if (hasWarehouseDefault) {
      return { label: "Warehouse default", variant: "secondary", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" }
    }
    if (leadTimes?.global) {
      return { label: "Global default", variant: "outline", className: "bg-muted text-muted-foreground" }
    }
    return { label: "5d fallback", variant: "outline", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading lead times...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Global Default */}
      <Card>
        <CardHeader>
          <CardTitle>Global Default Lead Time</CardTitle>
          <CardDescription>
            Fallback used when no warehouse or product-specific override is set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Manufacturing Days</Label>
              <Input
                type="number"
                min="0"
                className="h-9 w-24"
                value={globalForm.manufacturing_days}
                onChange={(e) =>
                  setGlobalForm((prev) => ({ ...prev, manufacturing_days: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Buffer Days</Label>
              <Input
                type="number"
                min="0"
                className="h-9 w-24"
                value={globalForm.buffer_days}
                onChange={(e) =>
                  setGlobalForm((prev) => ({ ...prev, buffer_days: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Business Days Only</Label>
              <div className="flex h-9 items-center">
                <Switch
                  checked={globalForm.use_business_days}
                  onCheckedChange={(checked: boolean) =>
                    setGlobalForm((prev) => ({ ...prev, use_business_days: checked }))
                  }
                />
              </div>
            </div>
            <Button
              onClick={handleSaveGlobal}
              disabled={globalSaving}
              className="h-9"
            >
              {globalSaving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Per-Warehouse Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Warehouse Defaults</CardTitle>
          <CardDescription>
            Override the global default for specific warehouses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {warehouses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No warehouses configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Mfg Days</TableHead>
                  <TableHead>Buffer Days</TableHead>
                  <TableHead>Business Days</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-16">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((w) => {
                  const row = getWarehouseRow(w.id)
                  const isSaving = warehouseSaving === w.id
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 w-20"
                          value={row.manufacturing_days}
                          onChange={(e) =>
                            setWarehouseEdits((prev) => ({
                              ...prev,
                              [w.id]: { ...getWarehouseRow(w.id), manufacturing_days: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 w-20"
                          value={row.buffer_days}
                          onChange={(e) =>
                            setWarehouseEdits((prev) => ({
                              ...prev,
                              [w.id]: { ...getWarehouseRow(w.id), buffer_days: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.use_business_days}
                          onCheckedChange={(checked: boolean) =>
                            setWarehouseEdits((prev) => ({
                              ...prev,
                              [w.id]: { ...getWarehouseRow(w.id), use_business_days: checked },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9 w-40"
                          value={row.notes}
                          onChange={(e) =>
                            setWarehouseEdits((prev) => ({
                              ...prev,
                              [w.id]: { ...getWarehouseRow(w.id), notes: e.target.value },
                            }))
                          }
                          placeholder="Optional note"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          disabled={isSaving}
                          onClick={() => handleSaveWarehouse(w.id)}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Product-Specific Overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Product-Specific Overrides</CardTitle>
          <CardDescription>
            Fine-grained lead time per product per warehouse. Falls back to warehouse or global default if not set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-72">
            <Select
              value={selectedWarehouseId}
              onValueChange={setSelectedWarehouseId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a warehouse..." />
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

          {!selectedWarehouseId ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Select a warehouse to view and edit product overrides.
            </p>
          ) : loadingMappings ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : mappings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No products mapped to this warehouse. Go to Product Mapping first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Mfg Days</TableHead>
                  <TableHead>Buffer Days</TableHead>
                  <TableHead>Business Days</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => {
                  const productId = mapping.product_id
                  const k = productOverrideKey(productId, selectedWarehouseId)
                  const row = getProductRow(productId, selectedWarehouseId)
                  const isSaving = productSaving === k
                  const source = getEffectiveSource(productId, selectedWarehouseId)
                  const hasOverride = leadTimes?.productWarehouse.some(
                    (pw) => pw.product_id === productId && pw.warehouse_id === selectedWarehouseId,
                  )
                  const productName = mapping.product?.name ?? productId

                  return (
                    <TableRow key={k}>
                      <TableCell className="font-medium">{productName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 w-20"
                          value={row.manufacturing_days}
                          onChange={(e) =>
                            setProductEdits((prev) => ({
                              ...prev,
                              [k]: { ...getProductRow(productId, selectedWarehouseId), manufacturing_days: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 w-20"
                          value={row.buffer_days}
                          onChange={(e) =>
                            setProductEdits((prev) => ({
                              ...prev,
                              [k]: { ...getProductRow(productId, selectedWarehouseId), buffer_days: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={row.use_business_days}
                          onCheckedChange={(checked: boolean) =>
                            setProductEdits((prev) => ({
                              ...prev,
                              [k]: { ...getProductRow(productId, selectedWarehouseId), use_business_days: checked },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9 w-36"
                          value={row.notes}
                          onChange={(e) =>
                            setProductEdits((prev) => ({
                              ...prev,
                              [k]: { ...getProductRow(productId, selectedWarehouseId), notes: e.target.value },
                            }))
                          }
                          placeholder="Optional"
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${source.className}`}
                        >
                          {source.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            disabled={isSaving}
                            onClick={() => handleSaveProductOverride(productId, selectedWarehouseId)}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          {hasOverride && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              disabled={productDeleting === k}
                              onClick={() => handleDeleteProductOverride(productId, selectedWarehouseId)}
                            >
                              {productDeleting === k ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
