"use client"

import { useState } from "react"
import Link from "next/link"
import { Package, ShoppingCart, Sparkles, Loader2, Check } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"
import { useQuery } from "@tanstack/react-query"
import { get } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-auth"
import { useAddToCart } from "@/lib/hooks/use-cart"
import { useProducts } from "@/lib/hooks/use-products"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface BundleProduct {
  id: string
  product_id: string
  product: {
    id: string
    name: string
    slug: string
    price: number
    unit: string
  } | null
}

interface Bundle {
  id: string
  name: string
  description: string | null
  discount_percent: number
  min_products: number
  badge_text: string | null
  is_active: boolean
  sort_order: number
  bundle_products: BundleProduct[]
}

const accentColors = [
  { hover: "hover:border-primary/30", badge: "bg-primary/15 text-primary" },
  { hover: "hover:border-sky-400/30", badge: "bg-sky-400/15 text-sky-400" },
  { hover: "hover:border-violet-400/30", badge: "bg-violet-400/15 text-violet-400" },
  { hover: "hover:border-amber-400/30", badge: "bg-amber-400/15 text-amber-400" },
]

export function CrossSellBundles() {
  const { user } = useUser()
  const { data: bundles, isLoading } = useQuery<Bundle[]>({
    queryKey: ["public-bundles"],
    queryFn: () => get<Bundle[]>("/admin/rewards/bundles"),
    staleTime: 300_000,
  })
  const { data: allProducts } = useProducts()
  const addToCart = useAddToCart()
  const [addingBundleId, setAddingBundleId] = useState<string | null>(null)
  const [addedBundleId, setAddedBundleId] = useState<string | null>(null)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  const activeBundles = bundles?.filter((b) => b.is_active) ?? []

  async function handleAddBundleToCart(bundle: Bundle) {
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    const products = bundle.bundle_products
      ?.map((bp) => bp.product)
      .filter(Boolean) ?? []

    if (products.length === 0) {
      toast.error("This bundle has no products configured yet")
      return
    }

    // Get packaging sizes from the full product data
    const productMap = new Map(
      (allProducts ?? []).map((p) => [p.id, p])
    )

    setAddingBundleId(bundle.id)

    try {
      for (const product of products) {
        if (!product) continue
        const fullProduct = productMap.get(product.id)
        const packagingSize =
          fullProduct?.packaging_sizes?.[0] ?? "20L Drum"

        await addToCart.mutateAsync({
          product_id: product.id,
          quantity: 1,
          packaging_size: packagingSize,
        })
      }
      setAddedBundleId(bundle.id)
      toast.success(
        `${bundle.name} added to cart! ${bundle.discount_percent}% discount will apply at checkout.`
      )
      setTimeout(() => setAddedBundleId(null), 3000)
    } catch {
      toast.error("Failed to add some products. Please try again.")
    } finally {
      setAddingBundleId(null)
    }
  }

  return (
    <section id="bundles" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              04 - Bundles
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              Cross-Sell Bundles
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Buy together, save together. Order multiple products and unlock
              bundle discounts automatically at checkout.
            </p>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : activeBundles.length === 0 ? (
          <FadeIn>
            <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No active bundles right now. Check back soon!
              </p>
            </div>
          </FadeIn>
        ) : (
          <StaggerContainer className="grid gap-5 sm:grid-cols-2">
            {activeBundles.map((bundle, idx) => {
              const products = bundle.bundle_products
                ?.map((bp) => bp.product)
                .filter(Boolean) ?? []
              const hasProducts = products.length > 0
              const accent = accentColors[idx % accentColors.length]
              const totalOriginal = products.reduce((s, p) => s + (p?.price ?? 0), 0)
              const totalDiscounted = totalOriginal * (1 - bundle.discount_percent / 100)
              const totalSaved = totalOriginal - totalDiscounted

              return (
                <StaggerItem key={bundle.id}>
                  <Card
                    className={cn(
                      "group h-full rounded-3xl border border-border/60 bg-card transition-all duration-300",
                      "hover:shadow-xl hover:shadow-primary/5",
                      accent.hover
                    )}
                  >
                    <CardContent className="flex h-full flex-col p-0">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                            <Package className="size-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold leading-tight text-foreground">{bundle.name}</h3>
                            {bundle.description && (
                              <p className="text-xs text-muted-foreground">{bundle.description}</p>
                            )}
                          </div>
                        </div>
                        <Badge className={cn("border-0 px-3 py-1 text-xs font-bold", accent.badge)}>
                          {bundle.badge_text || `${bundle.discount_percent}% OFF`}
                        </Badge>
                      </div>

                      {/* Products */}
                      <div className="flex-1 px-6 py-5">
                        {hasProducts ? (
                          <div className="space-y-2">
                            {products.map((product) => {
                              if (!product) return null
                              const discounted = product.price * (1 - bundle.discount_percent / 100)
                              return (
                                <Link
                                  key={product.id}
                                  href={`/products/${product.slug}`}
                                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 transition-all hover:border-primary/20 hover:bg-muted/40"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                                      <Sparkles className="size-3 text-primary" />
                                    </div>
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {product.name}
                                    </span>
                                  </div>
                                  <div className="ml-3 flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-muted-foreground line-through">
                                      AUD {product.price.toFixed(2)}
                                    </span>
                                    <span className="text-sm font-bold text-primary">
                                      AUD {discounted.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      /{product.unit}
                                    </span>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex h-full flex-col justify-center space-y-3 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="size-1.5 rounded-full bg-primary" />
                              <span className="text-sm text-muted-foreground">
                                Any {bundle.min_products}+ products in one order
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="size-1.5 rounded-full bg-primary" />
                              <span className="text-sm text-muted-foreground">
                                {bundle.discount_percent}% discount applied automatically
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="size-1.5 rounded-full bg-primary" />
                              <span className="text-sm text-muted-foreground">
                                Free freight included
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      {hasProducts && (
                        <div className="space-y-3 border-t border-border/60 px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              You save{" "}
                              <span className="font-semibold text-primary">
                                AUD {totalSaved.toFixed(2)}
                              </span>
                              /{products[0]?.unit ?? "L"} combined
                            </div>
                          </div>
                          <Button
                            className="h-12 w-full rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-shadow duration-200 hover:shadow-xl hover:shadow-primary/40"
                            disabled={addingBundleId === bundle.id}
                            onClick={() => handleAddBundleToCart(bundle)}
                          >
                            {addingBundleId === bundle.id ? (
                              <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Adding...
                              </>
                            ) : addedBundleId === bundle.id ? (
                              <>
                                <Check className="mr-2 size-4" />
                                Added to Cart!
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="mr-2 size-4" />
                                Add Bundle to Cart
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </StaggerContainer>
        )}
      </div>

      <AuthPromptDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        title="Sign in to add to cart"
        description="Create an account or sign in to add bundle products to your cart."
      />
    </section>
  )
}
