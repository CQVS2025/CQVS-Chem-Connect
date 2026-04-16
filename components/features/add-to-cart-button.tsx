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
  }
}

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
  const { user, loading: authLoading } = useUser()
  const { data: profile } = useProfile()
  const addToCart = useAddToCart()
  const { data: flags } = useFeatureFlags()
  const quotesEnabled = flags?.quotes_enabled !== false

  const isAdmin = profile?.role === "admin"
  const isLoggedIn = !!user

  const selectedOption = hasPricedOptions
    ? packagingPrices.find((p) => p.packaging_size.name === selectedSize)
    : null

  const selectedMoq = selectedOption?.minimum_order_quantity ?? 1

  const selectedUnitPrice = selectedOption
    ? calculateUnitPrice(
        priceType,
        selectedOption,
        selectedOption.packaging_size,
      )
    : null

  // Admin users see a message instead of order actions
  if (!authLoading && isLoggedIn && isAdmin) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Ordering is available for customer accounts only. You are logged in as
          an admin.
        </p>
      </div>
    )
  }

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

    if (!selectedSize) {
      toast.error("Please select a packaging size.")
      return
    }

    if (quantity < selectedMoq) {
      toast.error(`Minimum order quantity is ${selectedMoq} units.`)
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
              Subtotal ({quantity} x)
            </span>
            <span className="text-sm font-semibold">
              {formatPrice(selectedUnitPrice * quantity)}
            </span>
          </div>
        </div>
      )}

      {/* Quantity selector */}
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Quantity
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setQuantity(Math.max(selectedMoq, quantity - 1))}
            disabled={quantity <= selectedMoq}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="number"
            min={selectedMoq}
            max={stockQty}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= selectedMoq) {
                setQuantity(Math.min(val, stockQty))
              }
            }}
            className="h-9 w-16 rounded-md border border-input bg-background text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setQuantity(Math.min(quantity + 1, stockQty))}
            disabled={quantity >= stockQty}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {selectedMoq > 1 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Minimum order: {selectedMoq} units
          </p>
        )}
        {stockQty <= 20 && (
          <p className="mt-1 text-xs text-amber-500">
            Only {stockQty} units left in stock
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
    </div>
  )
}
