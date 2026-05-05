"use client"

import { useState } from "react"
import Link from "next/link"
import { ShoppingCart, Loader2, Check, Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { useUser } from "@/lib/hooks/use-auth"
import { useProfile } from "@/lib/hooks/use-profile"
import { useAddToCart } from "@/lib/hooks/use-cart"
import { useFeatureFlags } from "@/lib/hooks/use-feature-flags"
import { Button } from "@/components/ui/button"
import { RequestQuoteDialog } from "@/components/features/request-quote-dialog"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"
import { RoleBlockedDialog } from "@/components/shared/role-blocked-dialog"
import type { ProductPriceType } from "@/lib/supabase/types"
import { calculateUnitPrice, formatPrice } from "@/lib/pricing"

export interface AddToCartPackagingOption {
  id: string
  packaging_size_id: string
  price_per_litre: number | null
  fixed_price: number | null
  minimum_order_quantity: number | null
  packaging_size: {
    id: string
    name: string
    volume_litres: number | null
    container_type?: string | null
  }
}

// Identify supplier-managed bulk variants (tanker pump-in style). The
// quantity field semantically represents litres for these - buyers
// type the litres they want, not the number of containers. We
// surface a different label, helper text, and quick presets so the
// UX matches the B2B mental model.
function isBulkTankerOption(opt: AddToCartPackagingOption | null): boolean {
  if (!opt) return false
  const ct = opt.packaging_size.container_type?.toLowerCase() ?? ""
  if (ct === "tanker" || ct === "bulk") return true
  // Defensive: products configured with volume_litres = 1 are by
  // convention "price-per-litre with quantity = litres ordered".
  return opt.packaging_size.volume_litres === 1
}

const BULK_PRESET_LITRES = [1000, 5000, 10000, 20000]

interface AddToCartButtonProps {
  productId: string
  productName: string
  packagingSizes: string[]
  packagingPrices?: AddToCartPackagingOption[]
  priceType?: ProductPriceType
  inStock: boolean
  stockQty: number
}

export function AddToCartButton({
  productId,
  productName,
  packagingSizes,
  packagingPrices = [],
  priceType = "per_litre",
  inStock,
  stockQty,
}: AddToCartButtonProps) {
  // Prefer the new packaging_prices model when available; fall back to legacy strings
  const hasPricedOptions = packagingPrices.length > 0

  const initialSelection = hasPricedOptions
    ? packagingPrices[0].packaging_size.name
    : packagingSizes[0] || ""

  const initialMoq = hasPricedOptions ? (packagingPrices[0].minimum_order_quantity ?? 1) : 1

  const [selectedSize, setSelectedSize] = useState(initialSelection)
  const [quantity, setQuantity] = useState(initialMoq)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [roleBlockOpen, setRoleBlockOpen] = useState(false)
  const { user, loading: authLoading } = useUser()
  const { data: profile } = useProfile()
  const addToCart = useAddToCart()
  const { data: flags } = useFeatureFlags()
  const quotesEnabled = flags?.quotes_enabled !== false

  const role = profile?.role
  const isAdmin = role === "admin"
  const isSupplier = role === "supplier"
  const isPurchaseBlocked = isAdmin || isSupplier
  const isLoggedIn = !!user

  const selectedOption = hasPricedOptions
    ? packagingPrices.find((p) => p.packaging_size.name === selectedSize)
    : null

  const selectedMoq = selectedOption?.minimum_order_quantity ?? 1
  const isBulkTanker = isBulkTankerOption(selectedOption ?? null)
  const quantityLabel = isBulkTanker ? "Litres" : "Quantity"
  const unitWord = isBulkTanker ? "L" : "units"
  const subtotalCountLabel = isBulkTanker
    ? `${quantity.toLocaleString()} L`
    : `${quantity} ×`
  // Step in larger increments for tanker orders so +/- buttons are
  // useful at the scale the buyer is operating in.
  const quantityStep = isBulkTanker ? 100 : 1

  const selectedUnitPrice = selectedOption
    ? calculateUnitPrice(
        priceType,
        selectedOption,
        selectedOption.packaging_size,
      )
    : null

  // Admin and supplier users see a clear inline notice. Clicking the
  // (always-visible) Add to Cart button opens a dialog explaining the
  // need to switch to a customer account.
  const blockedNotice = !authLoading && isLoggedIn && isPurchaseBlocked && (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
      Ordering is for customer accounts only. You are signed in as a{" "}
      <strong>{isAdmin ? "admin" : "supplier"}</strong>. Sign out and create a
      separate customer account with a different email to place orders.
    </div>
  )

  // Out of stock
  if (!inStock || stockQty <= 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5 text-center">
          <div className="mb-2 text-lg font-semibold text-red-500">Out of Stock</div>
          <p className="text-sm text-muted-foreground">
            This product is currently unavailable. Check back soon when it is back in stock.
          </p>
        </div>
        {quotesEnabled && (
          <RequestQuoteDialog
            productId={productId}
            productName={productName}
            packagingSizes={packagingSizes}
          />
        )}
      </div>
    )
  }

  function handleAddToCart() {
    if (!isLoggedIn) {
      setAuthDialogOpen(true)
      return
    }

    if (isPurchaseBlocked) {
      setRoleBlockOpen(true)
      return
    }

    if (!selectedSize) {
      toast.error("Please select a packaging size.")
      return
    }

    if (quantity < selectedMoq) {
      toast.error(
        `Minimum order quantity is ${selectedMoq.toLocaleString()} ${
          isBulkTanker ? "L (one tanker drop)" : "units"
        }.`,
      )
      return
    }

    if (quantity > stockQty) {
      toast.error(`Only ${stockQty} units available.`, {
        description: `Please reduce your quantity to ${stockQty} or less.`,
      })
      return
    }

    addToCart.mutate(
      {
        product_id: productId,
        quantity,
        packaging_size: selectedSize,
        packaging_size_id: selectedOption?.packaging_size_id,
      },
      {
        onSuccess: () => {
          toast.success(
            <div className="flex flex-col gap-1">
              <span>{productName} added to cart</span>
              <Link
                href="/cart"
                className="text-sm font-medium text-primary underline underline-offset-2"
              >
                View Cart
              </Link>
            </div>,
          )
        },
        onError: () => {
          toast.error("Failed to add item to cart. Please try again.")
        },
      },
    )
  }

  // Render packaging options - use priced options if available, otherwise legacy strings
  const optionsToRender: Array<{ key: string; label: string; total: number | null }> =
    hasPricedOptions
      ? packagingPrices.map((p) => ({
          key: p.id,
          label: p.packaging_size.name,
          total: calculateUnitPrice(priceType, p, p.packaging_size),
        }))
      : packagingSizes.map((s) => ({ key: s, label: s, total: null }))

  return (
    <div className="space-y-4">
      {blockedNotice}
      {/* Packaging size selector */}
      {optionsToRender.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Packaging Size
          </p>
          <div className="flex flex-wrap gap-2">
            {optionsToRender.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setSelectedSize(opt.label)
                  const optMoq = hasPricedOptions
                    ? (packagingPrices.find((p) => p.packaging_size.name === opt.label)?.minimum_order_quantity ?? 1)
                    : 1
                  setQuantity(optMoq)
                }}
                className={`flex flex-col items-start rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  selectedSize === opt.label
                    ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <span>{opt.label}</span>
                {opt.total != null && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatPrice(opt.total)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected price summary */}
      {selectedUnitPrice != null && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Unit price</span>
            <span className="text-2xl font-bold text-primary">
              {formatPrice(selectedUnitPrice)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              Subtotal ({subtotalCountLabel})
            </span>
            <span className="text-sm font-semibold">
              {formatPrice(selectedUnitPrice * quantity)}
            </span>
          </div>
        </div>
      )}

      {/* Bulk tanker explainer - shown only when a bulk variant is selected */}
      {isBulkTanker && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
          <p className="font-medium text-foreground">
            Tanker pump-in delivery
          </p>
          <p className="mt-1 text-muted-foreground">
            Enter the total litres you need - the supplier dispatches a
            tanker truck and pumps the product directly into your on-site
            tank. Freight is priced per litre based on the distance from
            the supplier&rsquo;s closest depot to your delivery postcode.
          </p>
          {selectedMoq > 1 && (
            <p className="mt-2 text-foreground">
              Minimum order: <strong>{selectedMoq.toLocaleString()} L</strong>
              <span className="text-muted-foreground"> (one tanker drop)</span>
            </p>
          )}
        </div>
      )}

      {/* Quantity selector */}
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {quantityLabel}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() =>
              setQuantity(Math.max(selectedMoq, quantity - quantityStep))
            }
            disabled={quantity <= selectedMoq}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="number"
            min={selectedMoq}
            max={stockQty}
            step={quantityStep}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= selectedMoq) {
                setQuantity(Math.min(val, stockQty))
              }
            }}
            className={`h-9 ${isBulkTanker ? "w-24" : "w-16"} rounded-md border border-input bg-background text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() =>
              setQuantity(Math.min(quantity + quantityStep, stockQty))
            }
            disabled={quantity >= stockQty}
          >
            <Plus className="h-4 w-4" />
          </Button>
          {isBulkTanker && (
            <span className="ml-1 text-xs text-muted-foreground">
              litres
            </span>
          )}
        </div>

        {/* Bulk presets - common tanker drop sizes. Only render presets
            that meet MOQ and don't exceed available stock. */}
        {isBulkTanker && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BULK_PRESET_LITRES.filter(
              (n) => n >= selectedMoq && n <= stockQty,
            ).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuantity(preset)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  quantity === preset
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {preset.toLocaleString()} L
              </button>
            ))}
          </div>
        )}

        {!isBulkTanker && selectedMoq > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Minimum order: {selectedMoq} {unitWord}
          </p>
        )}
        {stockQty <= 20 && (
          <p className="mt-1 text-xs text-amber-500">
            Only {stockQty} {unitWord} left in stock
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-12 flex-1 gap-2 text-base sm:h-11 sm:text-sm glow-primary"
          onClick={handleAddToCart}
          disabled={addToCart.isPending || !selectedSize}
        >
          {addToCart.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Adding...
            </>
          ) : addToCart.isSuccess ? (
            <>
              <Check className="size-4" />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart className="size-4" />
              Add to Cart
            </>
          )}
        </Button>
        {quotesEnabled && (
          <RequestQuoteDialog
            productId={productId}
            productName={productName}
            packagingSizes={packagingSizes}
          />
        )}
      </div>

      {/* Auth prompt for unauthenticated users */}
      <AuthPromptDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        title="Sign in to order"
        description="Create an account or sign in to add products to your cart, place orders, and request custom quotes."
      />

      {/* Role-blocked dialog for admin / supplier accounts */}
      <RoleBlockedDialog
        open={roleBlockOpen}
        onOpenChange={setRoleBlockOpen}
        role={isAdmin ? "admin" : "supplier"}
      />
    </div>
  )
}
