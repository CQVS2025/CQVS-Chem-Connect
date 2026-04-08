"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  useCreateProduct,
  useUpdateProduct,
} from "@/lib/hooks/use-products"
import { usePackagingSizes } from "@/lib/hooks/use-packaging-sizes"
import { useUploadImage } from "@/lib/hooks/use-upload"
import { postForm } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { ProductPriceType } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ProductImageManager } from "@/components/features/product-image-manager"
import { ProductDocumentManager } from "@/components/features/product-document-manager"

function uploadProductSdsDocuments(productId: string, files: File[]) {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("doc_type", "sds")
  return postForm(`/products/${productId}/documents`, formData)
}

export interface ProductFormInitialData {
  id: string
  name: string
  price: number
  unit: string
  category: string
  description: string
  manufacturer: string
  classification: string
  cas_number: string
  safety_info: string
  packaging_sizes: string[]
  delivery_info: string
  region: string
  stock_qty: number
  in_stock: boolean
  shipping_fee: number
  badge: string | null
  image_url: string | null
  price_type: ProductPriceType
  packaging_prices: Array<{
    packaging_size_id: string
    price_per_litre: number | null
    fixed_price: number | null
  }>
}

interface ProductFormProps {
  mode: "create" | "edit"
  initial?: ProductFormInitialData
}

interface PackagingPriceRow {
  packaging_size_id: string
  price_per_litre: string
  fixed_price: string
}

export function ProductForm({ mode, initial }: ProductFormProps) {
  const router = useRouter()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const uploadImage = useUploadImage()
  const { data: packagingSizes = [] } = usePackagingSizes()

  // ---------- Form state ----------
  const [formName, setFormName] = useState(initial?.name ?? "")
  const [formPrice, setFormPrice] = useState(initial?.price?.toString() ?? "")
  const [formUnit, setFormUnit] = useState(initial?.unit ?? "L")
  const [formCategory, setFormCategory] = useState(initial?.category ?? "")
  const [formDescription, setFormDescription] = useState(initial?.description ?? "")
  const [formManufacturer, setFormManufacturer] = useState(initial?.manufacturer ?? "")
  const [formClassification, setFormClassification] = useState(initial?.classification ?? "Non-DG")
  const [formCasNumber, setFormCasNumber] = useState(initial?.cas_number ?? "")
  const [formSafetyInfo, setFormSafetyInfo] = useState(initial?.safety_info ?? "")
  const [formPackagingSizesText, setFormPackagingSizesText] = useState(
    initial?.packaging_sizes?.join(", ") ?? "",
  )
  const [formDeliveryInfo, setFormDeliveryInfo] = useState(
    initial?.delivery_info ?? "Ships from your state. 2-5 business day delivery.",
  )
  const [formRegions, setFormRegions] = useState<string[]>(
    initial?.region
      ? initial.region === "All"
        ? ["All"]
        : initial.region.split(",").map((r) => r.trim())
      : ["All"],
  )
  const [formStockQty, setFormStockQty] = useState(
    initial?.stock_qty?.toString() ?? "1",
  )
  const [formInStock, setFormInStock] = useState(initial?.in_stock ?? true)
  const [formShippingFee, setFormShippingFee] = useState(
    initial?.shipping_fee?.toString() ?? "0",
  )
  const [formBadge, setFormBadge] = useState(initial?.badge ?? "")
  const [formPriceType, setFormPriceType] = useState<ProductPriceType>(
    initial?.price_type ?? "per_litre",
  )
  const [formPackagingPrices, setFormPackagingPrices] = useState<PackagingPriceRow[]>(
    initial?.packaging_prices?.map((pp) => ({
      packaging_size_id: pp.packaging_size_id,
      price_per_litre: pp.price_per_litre?.toString() ?? "",
      fixed_price: pp.fixed_price?.toString() ?? "",
    })) ?? [],
  )

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [sdsFiles, setSdsFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  // Re-sync state if `initial` changes (e.g. after edit page loads data)
  useEffect(() => {
    if (!initial) return
    setFormName(initial.name)
    setFormPrice(initial.price.toString())
    setFormUnit(initial.unit)
    setFormCategory(initial.category)
    setFormDescription(initial.description)
    setFormManufacturer(initial.manufacturer)
    setFormClassification(initial.classification)
    setFormCasNumber(initial.cas_number)
    setFormSafetyInfo(initial.safety_info)
    setFormPackagingSizesText(initial.packaging_sizes.join(", "))
    setFormDeliveryInfo(initial.delivery_info)
    setFormRegions(
      initial.region === "All"
        ? ["All"]
        : initial.region
          ? initial.region.split(",").map((r) => r.trim())
          : ["All"],
    )
    setFormStockQty(initial.stock_qty.toString())
    setFormInStock(initial.in_stock)
    setFormShippingFee(initial.shipping_fee.toString())
    setFormBadge(initial.badge ?? "")
    setFormPriceType(initial.price_type ?? "per_litre")
    setFormPackagingPrices(
      initial.packaging_prices.map((pp) => ({
        packaging_size_id: pp.packaging_size_id,
        price_per_litre: pp.price_per_litre?.toString() ?? "",
        fixed_price: pp.fixed_price?.toString() ?? "",
      })),
    )
  }, [initial])

  // ---------- Validation ----------
  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (!formName.trim()) missing.push("Name")
    const price = parseFloat(formPrice)
    if (!price || price <= 0) missing.push("Price")
    if (!formCategory.trim()) missing.push("Category")
    if (!formDescription.trim()) missing.push("Description")
    if (!formManufacturer.trim()) missing.push("Manufacturer")
    if (formInStock && (parseInt(formStockQty) || 0) < 1)
      missing.push("Stock Qty")
    return missing
  }, [
    formName,
    formPrice,
    formCategory,
    formDescription,
    formManufacturer,
    formInStock,
    formStockQty,
  ])

  const isFormValid = missingFields.length === 0

  function togglePackagingSize(packagingSizeId: string) {
    setFormPackagingPrices((prev) => {
      const exists = prev.find((p) => p.packaging_size_id === packagingSizeId)
      if (exists) {
        return prev.filter((p) => p.packaging_size_id !== packagingSizeId)
      }
      return [
        ...prev,
        { packaging_size_id: packagingSizeId, price_per_litre: "", fixed_price: "" },
      ]
    })
  }

  function updatePackagingPrice(
    packagingSizeId: string,
    field: "price_per_litre" | "fixed_price",
    value: string,
  ) {
    setFormPackagingPrices((prev) =>
      prev.map((p) =>
        p.packaging_size_id === packagingSizeId ? { ...p, [field]: value } : p,
      ),
    )
  }

  async function handleSave() {
    if (!formName.trim()) return toast.error("Please enter a product name.")
    const price = parseFloat(formPrice)
    if (!price || price <= 0)
      return toast.error("Please set a valid price greater than $0.")
    if (!formCategory.trim()) return toast.error("Please select a category.")
    if (!formDescription.trim())
      return toast.error("Please add a product description.")
    if (!formManufacturer.trim())
      return toast.error("Please enter the manufacturer name.")
    if (formInStock && (parseInt(formStockQty) || 0) < 1)
      return toast.error("Stock quantity must be at least 1.")

    setSaving(true)
    let imageUrl: string | undefined

    if (imageFile) {
      try {
        const result = await uploadImage.mutateAsync(imageFile)
        imageUrl = result.url
      } catch {
        toast.error("Failed to upload image. Check size and format.")
        setSaving(false)
        return
      }
    }

    const packagingPricesPayload = formPackagingPrices
      .map((row) => {
        if (formPriceType === "per_litre") {
          const v = parseFloat(row.price_per_litre)
          return Number.isFinite(v) && v > 0
            ? {
                packaging_size_id: row.packaging_size_id,
                price_per_litre: v,
                fixed_price: null,
              }
            : null
        }
        const v = parseFloat(row.fixed_price)
        return Number.isFinite(v) && v > 0
          ? {
              packaging_size_id: row.packaging_size_id,
              price_per_litre: null,
              fixed_price: v,
            }
          : null
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    // Mirror selected packaging sizes back into the legacy text array
    const packagingNames = formPackagingPrices
      .map(
        (row) =>
          packagingSizes.find((ps) => ps.id === row.packaging_size_id)?.name,
      )
      .filter((n): n is string => !!n)

    const productData = {
      name: formName,
      price: parseFloat(formPrice) || 0,
      unit: formUnit || "L",
      category: formCategory,
      description: formDescription,
      manufacturer: formManufacturer,
      classification: formClassification,
      cas_number: formCasNumber || "N/A",
      safety_info: formSafetyInfo,
      packaging_sizes:
        packagingNames.length > 0
          ? packagingNames
          : formPackagingSizesText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      delivery_info: formDeliveryInfo,
      region: formRegions.includes("All") ? "All" : formRegions.join(","),
      stock_qty: parseInt(formStockQty) || 0,
      in_stock: formInStock,
      shipping_fee: parseFloat(formShippingFee) || 0,
      badge: formBadge && formBadge !== "none" ? formBadge : null,
      price_type: formPriceType,
      packaging_prices: packagingPricesPayload,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }

    if (mode === "edit" && initial) {
      updateProduct.mutate(
        { id: initial.id, data: productData },
        {
          onSuccess: () => {
            toast.success("Product updated")
            setSaving(false)
            router.push("/admin/products")
          },
          onError: () => {
            toast.error("Unable to update product. Please try again.")
            setSaving(false)
          },
        },
      )
    } else {
      createProduct.mutate(productData, {
        onSuccess: async (newProduct) => {
          if (sdsFiles.length > 0 && newProduct?.id) {
            uploadProductSdsDocuments(newProduct.id, sdsFiles).catch(() => {})
          }
          toast.success("Product created")
          setSaving(false)
          router.push("/admin/products")
        },
        onError: () => {
          toast.error("Unable to create product. Please check the details.")
          setSaving(false)
        },
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mode === "edit" ? "Edit Product" : "Add New Product"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "edit"
                ? "Update product details, pricing, and packaging."
                : "Fill in the details for your new product."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/products">Cancel</Link>
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isFormValid}
            className="glow-primary"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {mode === "edit" ? "Save Changes" : "Create Product"}
              </>
            )}
          </Button>
        </div>
      </div>

      {!isFormValid && missingFields.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">
          Required fields missing: {missingFields.join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - main details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="product-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="product-name"
                  placeholder="Product name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="product-price">
                    Base Price <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="product-price"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Legacy fallback. Per-size pricing below takes precedence.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-unit">Unit</Label>
                  <Input
                    id="product-unit"
                    placeholder="e.g. L, kg, bag"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-category">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="product-category"
                  placeholder="e.g. Cleaning, Acid, Automotive"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="product-description"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Product description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-manufacturer">
                  Manufacturer <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="product-manufacturer"
                  placeholder="Manufacturer name"
                  value={formManufacturer}
                  onChange={(e) => setFormManufacturer(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="product-classification">Classification</Label>
                  <Select
                    value={formClassification}
                    onValueChange={setFormClassification}
                  >
                    <SelectTrigger id="product-classification">
                      <SelectValue placeholder="Classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Non-DG">Non-DG</SelectItem>
                      <SelectItem value="DG Class 3">DG Class 3</SelectItem>
                      <SelectItem value="DG Class 8">DG Class 8</SelectItem>
                      <SelectItem value="DG Class 5">DG Class 5</SelectItem>
                      <SelectItem value="DG Class 6">DG Class 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-cas">CAS Number</Label>
                  <Input
                    id="product-cas"
                    placeholder="e.g. 7647-01-0"
                    value={formCasNumber}
                    onChange={(e) => setFormCasNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-safety">Safety Information</Label>
                <Input
                  id="product-safety"
                  placeholder="PPE requirements, hazard info..."
                  value={formSafetyInfo}
                  onChange={(e) => setFormSafetyInfo(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & packaging */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing &amp; Packaging</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Price Type</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormPriceType("per_litre")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      formPriceType === "per_litre"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    Per Litre
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormPriceType("fixed")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      formPriceType === "fixed"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    Fixed Price
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formPriceType === "per_litre"
                    ? "Total = price per litre x packaging size litres x quantity"
                    : "Total = fixed price x quantity"}
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Packaging Sizes &amp; Pricing</Label>
                <p className="text-xs text-muted-foreground">
                  Select the sizes this product is sold in and set the price for each.
                </p>
                <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
                  {packagingSizes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No packaging sizes configured yet.
                    </p>
                  )}
                  {packagingSizes.map((ps) => {
                    const row = formPackagingPrices.find(
                      (r) => r.packaging_size_id === ps.id,
                    )
                    const isSelected = !!row
                    return (
                      <div key={ps.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePackagingSize(ps.id)}
                          className={cn(
                            "flex h-9 min-w-32 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors",
                            isSelected
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-white/10 bg-muted/20 text-muted-foreground hover:border-primary/20",
                          )}
                        >
                          {ps.name}
                          {ps.volume_litres ? ` (${ps.volume_litres}L)` : ""}
                        </button>
                        {isSelected && row && (
                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-xs text-muted-foreground">$</span>
                            {formPriceType === "per_litre" ? (
                              <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                placeholder="Price per litre"
                                value={row.price_per_litre}
                                onChange={(e) =>
                                  updatePackagingPrice(
                                    ps.id,
                                    "price_per_litre",
                                    e.target.value,
                                  )
                                }
                                className="h-9"
                              />
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Fixed price"
                                value={row.fixed_price}
                                onChange={(e) =>
                                  updatePackagingPrice(
                                    ps.id,
                                    "fixed_price",
                                    e.target.value,
                                  )
                                }
                                className="h-9"
                              />
                            )}
                            {formPriceType === "per_litre" && ps.volume_litres && (
                              <span className="whitespace-nowrap text-xs text-muted-foreground">
                                = $
                                {(
                                  (parseFloat(row.price_per_litre) || 0) *
                                  Number(ps.volume_litres)
                                ).toFixed(2)}{" "}
                                total
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images &amp; Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "edit" && initial ? (
                <>
                  <div className="grid gap-2">
                    <Label>Product Images</Label>
                    <ProductImageManager
                      productId={initial.id}
                      legacyImageUrl={initial.image_url}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Safety Data Sheets (SDS)</Label>
                    <ProductDocumentManager productId={initial.id} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="product-image">Product Image</Label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="product-image"
                        className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/50 hover:bg-muted"
                      >
                        {imageFile ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={URL.createObjectURL(imageFile)}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        )}
                      </label>
                      <div className="flex-1">
                        <input
                          id="product-image"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            setImageFile(e.target.files?.[0] || null)
                          }
                        />
                        <p className="text-sm text-muted-foreground">
                          {imageFile
                            ? imageFile.name
                            : "Upload a cover image. Add more after creating."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>
                      SDS Documents{" "}
                      <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    {sdsFiles.length > 0 && (
                      <div className="space-y-2">
                        {sdsFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(0)} KB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() =>
                                setSdsFiles(sdsFiles.filter((_, i) => i !== idx))
                              }
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input")
                        input.type = "file"
                        input.multiple = true
                        input.accept =
                          ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files
                          if (files)
                            setSdsFiles((prev) => [...prev, ...Array.from(files)])
                        }
                        input.click()
                      }}
                    >
                      <Upload className="mr-2 h-3 w-3" />
                      {sdsFiles.length > 0
                        ? "Add More"
                        : "Attach SDS Documents"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - inventory & meta */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Stock Status</Label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !formInStock
                    setFormInStock(next)
                    if (!next) setFormStockQty("0")
                    else if (formStockQty === "0") setFormStockQty("1")
                  }}
                  className={`flex h-10 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                    formInStock
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-red-500/30 bg-red-500/10 text-red-500"
                  }`}
                >
                  {formInStock ? "In Stock" : "Out of Stock"}
                </button>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-stock-qty">
                  Stock Quantity{" "}
                  {formInStock && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <Input
                  id="product-stock-qty"
                  placeholder="1"
                  type="number"
                  min={formInStock ? "1" : "0"}
                  value={formStockQty}
                  onChange={(e) => setFormStockQty(e.target.value)}
                  disabled={!formInStock}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-badge">Product Badge</Label>
                <Select value={formBadge} onValueChange={setFormBadge}>
                  <SelectTrigger id="product-badge">
                    <SelectValue placeholder="No badge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Badge</SelectItem>
                    <SelectItem value="Best Seller">Best Seller</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Coming Soon">Coming Soon</SelectItem>
                    <SelectItem value="Popular">Popular</SelectItem>
                    <SelectItem value="Limited Stock">Limited Stock</SelectItem>
                    <SelectItem value="DG Class 3">DG Class 3</SelectItem>
                    <SelectItem value="DG Class 5">DG Class 5</SelectItem>
                    <SelectItem value="DG Class 6">DG Class 6</SelectItem>
                    <SelectItem value="DG Class 8">DG Class 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Region</Label>
                <div className="flex flex-wrap gap-1.5">
                  {["All", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map(
                    (r) => {
                      const isAll = r === "All"
                      const isSelected = isAll
                        ? formRegions.includes("All")
                        : formRegions.includes(r)
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (isAll) {
                              setFormRegions(["All"])
                            } else {
                              let next = formRegions.filter((x) => x !== "All")
                              if (next.includes(r)) {
                                next = next.filter((x) => x !== r)
                              } else {
                                next = [...next, r]
                              }
                              setFormRegions(next.length === 0 ? ["All"] : next)
                            }
                          }}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            isSelected
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-white/10 bg-muted/20 text-muted-foreground hover:border-primary/20",
                          )}
                        >
                          {r}
                        </button>
                      )
                    },
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formRegions.includes("All")
                    ? "Available in all regions"
                    : `Available in: ${formRegions.join(", ")}`}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-delivery">Delivery Info</Label>
                <Input
                  id="product-delivery"
                  placeholder="Shipping details..."
                  value={formDeliveryInfo}
                  onChange={(e) => setFormDeliveryInfo(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer save bar */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" asChild>
          <Link href="/admin/products">Cancel</Link>
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !isFormValid}
          className="glow-primary"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {mode === "edit" ? "Save Changes" : "Create Product"}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
