"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Package,
  ArrowRight,
  ShoppingCart,
  Loader2,
  Check,
  Sparkles,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"
import { useBundles } from "@/lib/hooks/use-rewards"
import { useUser } from "@/lib/hooks/use-auth"
import { useAddToCart } from "@/lib/hooks/use-cart"
import { useProducts } from "@/lib/hooks/use-products"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface BundleIndicatorProps {
  productId: string
}

export function BundleIndicator({ productId }: BundleIndicatorProps) {
  const { user } = useUser()
  const { data: bundles } = useBundles()
  const { data: allProducts } = useProducts()
  const addToCart = useAddToCart()
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!bundles) return null

  const matchingBundles = bundles.filter(
    (b) =>
      b.is_active &&
      b.bundle_products?.some((bp) => bp.product_id === productId)
  )

  if (matchingBundles.length === 0) return null

  const productMap = new Map(
    (allProducts ?? []).map((p) => [p.id, p])
  )

  async function handleAddBundle(bundle: typeof matchingBundles[0]) {
    if (!user) {
      setShowAuth(true)
      return
    }

    const products = bundle.bundle_products
      ?.map((bp) => bp.product)
      .filter(Boolean) ?? []

    if (products.length === 0) return

    setAddingId(bundle.id)
    try {
      for (const product of products) {
        if (!product) continue
        const full = productMap.get(product.id)
        await addToCart.mutateAsync({
          product_id: product.id,
          quantity: 1,
          packaging_size: full?.packaging_sizes?.[0] ?? "20L Drum",
        })
      }
      setAddedId(bundle.id)
      toast.success(
        `All ${products.length} products added! ${bundle.discount_percent}% discount applies at checkout.`
      )
      setTimeout(() => setAddedId(null), 3000)
    } catch {
      toast.error("Failed to add some products. Please try again.")
    } finally {
      setAddingId(null)
    }
  }

  // Find the best (highest discount) bundle to feature
  const sorted = [...matchingBundles].sort(
    (a, b) => b.discount_percent - a.discount_percent
  )
  const bestBundle = sorted[0]
  const otherBundles = sorted.slice(1)

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5">
            <Sparkles className="size-4 text-primary" />
            <p className="text-sm font-bold">
              Bundle & Save
            </p>
            <span className="text-xs text-muted-foreground">
              {matchingBundles.length === 1
                ? "This product is part of a bundle"
                : `Part of ${matchingBundles.length} bundles`}
            </span>
          </div>

          {/* Best bundle - always visible */}
          <BundleRow
            bundle={bestBundle}
            productId={productId}
            isAdding={addingId === bestBundle.id}
            isAdded={addedId === bestBundle.id}
            onAdd={() => handleAddBundle(bestBundle)}
            defaultExpanded={matchingBundles.length === 1}
            expanded={matchingBundles.length === 1 || expandedId === bestBundle.id}
            onToggle={() =>
              setExpandedId(expandedId === bestBundle.id ? null : bestBundle.id)
            }
            isBest
          />

          {/* Other bundles */}
          {otherBundles.map((bundle) => (
            <BundleRow
              key={bundle.id}
              bundle={bundle}
              productId={productId}
              isAdding={addingId === bundle.id}
              isAdded={addedId === bundle.id}
              onAdd={() => handleAddBundle(bundle)}
              expanded={expandedId === bundle.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === bundle.id ? null : bundle.id
                )
              }
            />
          ))}
        </CardContent>
      </Card>

      <AuthPromptDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        title="Sign in to add to cart"
        description="Create an account or sign in to add bundle products to your cart."
      />
    </>
  )
}

function BundleRow({
  bundle,
  productId,
  isAdding,
  isAdded,
  onAdd,
  expanded,
  onToggle,
  defaultExpanded,
  isBest,
}: {
  bundle: {
    id: string
    name: string
    discount_percent: number
    min_products: number
    bundle_products?: {
      product_id: string
      product: {
        id: string
        name: string
        slug: string
        price: number
        unit: string
      } | null
    }[]
  }
  productId: string
  isAdding: boolean
  isAdded: boolean
  onAdd: () => void
  expanded?: boolean
  onToggle: () => void
  defaultExpanded?: boolean
  isBest?: boolean
}) {
  const allBundleProducts =
    bundle.bundle_products
      ?.filter((bp) => bp.product)
      .map((bp) => ({ ...bp.product!, isCurrent: bp.product_id === productId })) ?? []
  const totalProducts = allBundleProducts.length

  return (
    <div className={cn("border-t border-primary/10", isBest && "border-t-0")}>
      {/* Clickable row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge
            className={cn(
              "shrink-0 border-0 font-bold",
              isBest
                ? "bg-primary text-primary-foreground"
                : "bg-primary/15 text-primary"
            )}
          >
            {bundle.discount_percent}% OFF
          </Badge>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{bundle.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {totalProducts} products - add all to get discount
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isBest && !expanded && (
            <span className="hidden text-[10px] font-bold uppercase tracking-wider text-primary sm:block">
              Best value
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {allBundleProducts.length > 0 && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Products in this bundle:
              </p>
              <div className="space-y-1">
                {allBundleProducts.map((p) =>
                  p.isCurrent ? (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <Check className="size-3 text-primary" />
                        <span className="truncate font-semibold text-primary">{p.name}</span>
                        <span className="text-[10px] text-primary/70">(this product)</span>
                      </div>
                      <span className="font-bold text-primary shrink-0 ml-2">
                        ${(p.price * (1 - bundle.discount_percent / 100)).toFixed(2)}/{p.unit}
                      </span>
                    </div>
                  ) : (
                    <Link
                      key={p.id}
                      href={`/products/${p.slug}`}
                      className="flex items-center justify-between rounded-md border border-primary/10 bg-background/50 px-2.5 py-1.5 text-xs transition-all hover:border-primary/25 hover:bg-background/80"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <div className="ml-2 flex items-center gap-1.5 shrink-0">
                        <span className="text-muted-foreground line-through">
                          ${p.price.toFixed(2)}
                        </span>
                        <span className="font-bold text-primary">
                          ${(p.price * (1 - bundle.discount_percent / 100)).toFixed(2)}
                        </span>
                        <ArrowRight className="size-2.5 text-muted-foreground/50" />
                      </div>
                    </Link>
                  )
                )}
              </div>
            </>
          )}
          <Button
            size="sm"
            className="w-full shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40"
            disabled={isAdding}
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Adding...
              </>
            ) : isAdded ? (
              <>
                <Check className="mr-1.5 size-3.5" />
                Added!
              </>
            ) : (
              <>
                <ShoppingCart className="mr-1.5 size-3.5" />
                Add All {totalProducts} to Cart
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
