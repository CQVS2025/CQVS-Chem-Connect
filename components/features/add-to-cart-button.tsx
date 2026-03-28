"use client"

import { useState } from "react"
import Link from "next/link"
import { ShoppingCart, Loader2, Check, Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import { useUser } from "@/lib/hooks/use-auth"
import { useProfile } from "@/lib/hooks/use-profile"
import { useAddToCart } from "@/lib/hooks/use-cart"
import { Button } from "@/components/ui/button"
import { RequestQuoteDialog } from "@/components/features/request-quote-dialog"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"

interface AddToCartButtonProps {
  productId: string
  productName: string
  packagingSizes: string[]
}

export function AddToCartButton({
  productId,
  productName,
  packagingSizes,
}: AddToCartButtonProps) {
  const [selectedSize, setSelectedSize] = useState(packagingSizes[0] || "")
  const [quantity, setQuantity] = useState(1)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const { user, loading: authLoading } = useUser()
  const { data: profile } = useProfile()
  const addToCart = useAddToCart()

  const isAdmin = profile?.role === "admin"
  const isLoggedIn = !!user

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

  function handleAddToCart() {
    if (!isLoggedIn) {
      setAuthDialogOpen(true)
      return
    }

    if (!selectedSize) {
      toast.error("Please select a packaging size.")
      return
    }

    addToCart.mutate(
      {
        product_id: productId,
        quantity,
        packaging_size: selectedSize,
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

  return (
    <div className="space-y-4">
      {/* Packaging size selector */}
      {packagingSizes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Packaging Size
          </p>
          <div className="flex flex-wrap gap-2">
            {packagingSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  selectedSize === size
                    ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                {size}
              </button>
            ))}
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
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val >= 1) {
                setQuantity(val)
              }
            }}
            className="h-9 w-16 rounded-md border border-input bg-background text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="flex-1 gap-2 glow-primary"
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
        <RequestQuoteDialog
          productId={productId}
          productName={productName}
          packagingSizes={packagingSizes}
        />
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
