"use client"

import { useState, useMemo } from "react"
import {
  FileText,
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/lib/hooks/use-products"
import { useUploadImage } from "@/lib/hooks/use-upload"
import { postForm } from "@/lib/api/client"
import { products as staticProducts, categories } from "@/lib/data/products"

function uploadProductSdsDocuments(productId: string, files: File[]) {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("doc_type", "sds")
  return postForm(`/products/${productId}/documents`, formData)
}
import { PageTransition } from "@/components/shared/page-transition"
import { ProductImageManager } from "@/components/features/product-image-manager"
import { ProductDocumentManager } from "@/components/features/product-document-manager"
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

export default function AdminProductsPage() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formUnit, setFormUnit] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formManufacturer, setFormManufacturer] = useState("")
  const [formClassification, setFormClassification] = useState("Non-DG")
  const [formCasNumber, setFormCasNumber] = useState("")
  const [formSafetyInfo, setFormSafetyInfo] = useState("")
  const [formPackagingSizes, setFormPackagingSizes] = useState("")
  const [formDeliveryInfo, setFormDeliveryInfo] = useState("")
  const [formRegion, setFormRegion] = useState("NSW")
  const [formStockQty, setFormStockQty] = useState("")
  const [formInStock, setFormInStock] = useState(true)
  const [formShippingFee, setFormShippingFee] = useState("0")
  const [formBadge, setFormBadge] = useState("")
  const [formExistingImage, setFormExistingImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [sdsFiles, setSdsFiles] = useState<File[]>([])

  // Supabase data with static fallback
  const { data: apiProducts, isLoading } = useProducts()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const uploadImage = useUploadImage()

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
        casNumber: p.cas_number,
        safetyInfo: p.safety_info,
        packagingSizes: p.packaging_sizes,
        deliveryInfo: p.delivery_info,
        region: p.region,
        inStock: p.in_stock,
        stockQty: p.stock_qty,
        description: p.description,
        manufacturer: p.manufacturer,
        imageUrl: p.image_url,
        badge: p.badge,
        shippingFee: p.shipping_fee ?? 0,
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
      casNumber: p.casNumber,
      safetyInfo: p.safetyInfo,
      packagingSizes: p.packagingSizes,
      deliveryInfo: p.deliveryInfo,
      region: p.region,
      inStock: p.inStock,
      stockQty: p.stockQty,
      description: p.description,
      manufacturer: p.manufacturer,
      imageUrl: p.image ?? null,
      badge: p.badge ?? null,
      shippingFee: 0,
    }))
  }, [apiProducts])

  const filtered = allProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      categoryFilter === "All" || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  function openAddDialog() {
    setEditingId(null)
    setFormName("")
    setFormPrice("")
    setFormUnit("L")
    setFormCategory("")
    setFormDescription("")
    setFormManufacturer("")
    setFormClassification("Non-DG")
    setFormCasNumber("")
    setFormSafetyInfo("")
    setFormPackagingSizes("")
    setFormDeliveryInfo("Ships from your state. 2-5 business day delivery.")
    setFormRegion("NSW")
    setFormStockQty("1")
    setFormInStock(true)
    setFormShippingFee("0")
    setFormBadge("")
    setFormExistingImage(null)
    setImageFile(null)
    setSdsFiles([])
    setDialogOpen(true)
  }

  function openEditDialog(product: (typeof allProducts)[0]) {
    setEditingId(product.id)
    setFormName(product.name)
    setFormPrice(product.price.toString())
    setFormUnit(product.unit)
    setFormCategory(product.category)
    setFormDescription(product.description)
    setFormManufacturer(product.manufacturer)
    setFormClassification(product.classification)
    setFormCasNumber(product.casNumber)
    setFormSafetyInfo(product.safetyInfo)
    setFormPackagingSizes(product.packagingSizes.join(", "))
    setFormDeliveryInfo(product.deliveryInfo)
    setFormRegion(product.region)
    setFormStockQty(product.stockQty.toString())
    setFormInStock(product.inStock)
    setFormShippingFee((product.shippingFee ?? 0).toString())
    setFormBadge(product.badge || "")
    setFormExistingImage(product.imageUrl)
    setImageFile(null)
    setDialogOpen(true)
  }

  const [saving, setSaving] = useState(false)

  // Live validation - tracks which required fields are missing
  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (!formName.trim()) missing.push("Name")
    const price = parseFloat(formPrice)
    if (!price || price <= 0) missing.push("Price")
    if (!formCategory.trim()) missing.push("Category")
    if (!formDescription.trim()) missing.push("Description")
    if (!formManufacturer.trim()) missing.push("Manufacturer")
    if (formInStock && (parseInt(formStockQty) || 0) < 1) missing.push("Stock Qty")
    return missing
  }, [formName, formPrice, formCategory, formDescription, formManufacturer, formInStock, formStockQty])

  const isFormValid = missingFields.length === 0

  async function handleSave() {
    // Show specific validation messages
    if (!formName.trim()) {
      toast.error("Please enter a product name.")
      return
    }
    const price = parseFloat(formPrice)
    if (!price || price <= 0) {
      toast.error("Please set a valid price greater than $0.")
      return
    }
    if (!formCategory.trim()) {
      toast.error("Please select or enter a product category (e.g. Cleaning, Acid, Automotive).")
      return
    }
    if (!formDescription.trim()) {
      toast.error("Please add a product description so customers know what this product is.")
      return
    }
    if (!formManufacturer.trim()) {
      toast.error("Please enter the manufacturer name.")
      return
    }
    if (formInStock && (parseInt(formStockQty) || 0) < 1) {
      toast.error("Stock quantity must be at least 1 when the product is marked as In Stock.")
      return
    }

    setSaving(true)
    let imageUrl: string | undefined

    // Upload image first if selected
    if (imageFile) {
      try {
        const result = await uploadImage.mutateAsync(imageFile)
        imageUrl = result.url
      } catch (err) {
        toast.error("Failed to upload image", {
          description: "Please check the file size and format, then try again.",
        })
        setSaving(false)
        return
      }
    }

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
      packaging_sizes: formPackagingSizes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      delivery_info: formDeliveryInfo,
      region: formRegion,
      stock_qty: parseInt(formStockQty) || 0,
      in_stock: formInStock,
      shipping_fee: parseFloat(formShippingFee) || 0,
      badge: formBadge && formBadge !== "none" ? formBadge : null,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    }

    if (editingId) {
      updateProduct.mutate(
        { id: editingId, data: productData },
        {
          onSuccess: () => {
            toast.success("Product updated")
            setSaving(false)
            setDialogOpen(false)
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
          // Upload SDS files if any
          if (sdsFiles.length > 0 && newProduct?.id) {
            uploadProductSdsDocuments(newProduct.id, sdsFiles).catch(() => {
              // Non-blocking
            })
          }
          toast.success("Product created")
          setSaving(false)
          setDialogOpen(false)
        },
        onError: () => {
          toast.error("Unable to create product. Please check the details and try again.")
          setSaving(false)
        },
      })
    }
  }

  function handleDelete(id: string) {
    deleteProduct.mutate(id, {
      onSuccess: () => {
        toast.success("Product deleted")
        setDeleteConfirm(null)
      },
      onError: () => toast.error("Unable to delete product. It may be linked to existing orders."),
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
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
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
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
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
            <CardTitle>
              All Products ({filtered.length})
            </CardTitle>
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
                              ? "bg-red-500/10 text-red-500 border-red-500/20"
                              : "bg-green-500/10 text-green-500 border-green-500/20"
                          }
                        >
                          {product.classification}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {product.inStock ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          >
                            In Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-500/10 text-red-500 border-red-500/20"
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
                            onClick={() => openEditDialog(product)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
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
                        className="text-center text-muted-foreground py-8"
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Product" : "Add New Product"}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the product details below."
                  : "Fill in the details for the new product."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="product-name">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="product-name"
                  placeholder="Product name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="product-price">Price <span className="text-destructive">*</span></Label>
                  <Input
                    id="product-price"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
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
                <Label htmlFor="product-category">Category <span className="text-destructive">*</span></Label>
                <Input
                  id="product-category"
                  placeholder="e.g. Cleaning, Acid, Automotive"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-description">Description <span className="text-destructive">*</span></Label>
                <Input
                  id="product-description"
                  placeholder="Product description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-manufacturer">Manufacturer <span className="text-destructive">*</span></Label>
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
              <div className="grid gap-2">
                <Label htmlFor="product-packaging">
                  Packaging Sizes{" "}
                  <span className="text-xs text-muted-foreground">
                    (comma separated)
                  </span>
                </Label>
                <Input
                  id="product-packaging"
                  placeholder="20L Drum, 200L Drum, 1000L IBC"
                  value={formPackagingSizes}
                  onChange={(e) => setFormPackagingSizes(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="product-delivery">Delivery Info</Label>
                  <Input
                    id="product-delivery"
                    placeholder="Shipping details..."
                    value={formDeliveryInfo}
                    onChange={(e) => setFormDeliveryInfo(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="product-region">Region</Label>
                  <Select value={formRegion} onValueChange={setFormRegion}>
                    <SelectTrigger id="product-region">
                      <SelectValue placeholder="Region" />
                    </SelectTrigger>
                    <SelectContent>
                      {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map(
                        (r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Shipping Fee */}
              <div className="grid gap-2">
                <Label htmlFor="product-shipping-fee">Shipping Fee (AUD)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormShippingFee("0")}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        parseFloat(formShippingFee) === 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      Free Shipping
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (parseFloat(formShippingFee) === 0) setFormShippingFee("") }}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        parseFloat(formShippingFee) > 0 || formShippingFee === ""
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      Fixed Fee
                    </button>
                  </div>
                  {(parseFloat(formShippingFee) > 0 || formShippingFee === "") && (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="product-shipping-fee"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-24"
                        value={formShippingFee}
                        onChange={(e) => setFormShippingFee(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="product-stock-qty">
                    Stock Quantity {formInStock && <span className="text-destructive">*</span>}
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
              </div>
              {/* Badge */}
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

              {/* Images - show manager for existing products, simple upload for new */}
              {editingId ? (
                <>
                  <div className="grid gap-2">
                    <Label>Product Images</Label>
                    <ProductImageManager productId={editingId} legacyImageUrl={formExistingImage} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Safety Data Sheets (SDS)</Label>
                    <ProductDocumentManager productId={editingId} />
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
                          : "Upload a cover image. You can add more images after creating the product."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SDS Documents for new products */}
                <div className="grid gap-2">
                  <Label>SDS Documents <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  {sdsFiles.length > 0 && (
                    <div className="space-y-2">
                      {sdsFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => setSdsFiles(sdsFiles.filter((_, i) => i !== idx))}
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
                      input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files
                        if (files) setSdsFiles((prev) => [...prev, ...Array.from(files)])
                      }
                      input.click()
                    }}
                  >
                    <Upload className="mr-2 h-3 w-3" />
                    {sdsFiles.length > 0 ? "Add More" : "Attach SDS Documents"}
                  </Button>
                </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>)
                  : editingId
                    ? "Save Changes"
                    : "Add Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  )
}
