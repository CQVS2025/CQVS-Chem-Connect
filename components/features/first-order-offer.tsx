"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Gift,
  ShoppingCart,
  Loader2,
  Check,
  Sparkles,
  X,
  Truck,
  FlaskConical,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOrders } from "@/lib/hooks/use-orders"
import { useProducts } from "@/lib/hooks/use-products"
import { useAddToCart, useCart, useRemoveCartItem } from "@/lib/hooks/use-cart"
import { useRewards } from "@/lib/hooks/use-rewards"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const TRUCK_WASH_SLUGS = ["truck-wash-standard", "truck-wash-premium"]

export type FirstOrderChoice = "free_freight" | "half_price_truck_wash" | null

interface FirstOrderOfferProps {
  className?: string
  selectedOption?: FirstOrderChoice
  onSelectOption?: (option: FirstOrderChoice) => void
  selectedTruckWash?: string | null
  onSelectTruckWash?: (slug: string | null) => void
}

export function FirstOrderOffer({
  className,
  selectedOption,
  onSelectOption,
  selectedTruckWash,
  onSelectTruckWash,
}: FirstOrderOfferProps) {
  const { data: orders } = useOrders()
  const { data: rewards } = useRewards()
  const { data: allProducts } = useProducts()
  const { data: cartItems } = useCart()
  const addToCart = useAddToCart()
  const removeCartItem = useRemoveCartItem()
  const [addingSlug, setAddingSlug] = useState<string | null>(null)
  const [addedSlug, setAddedSlug] = useState<string | null>(null)
  const [removingSlug, setRemovingSlug] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const [internalOption, setInternalOption] = useState<FirstOrderChoice>(null)
  const [internalTW, setInternalTW] = useState<string | null>(null)
  const chosen = selectedOption !== undefined ? selectedOption : internalOption
  const setChosen = onSelectOption || setInternalOption
  const chosenTW = selectedTruckWash !== undefined ? selectedTruckWash : internalTW
  const setChosenTW = onSelectTruckWash || setInternalTW

  const hasOrders = orders && orders.length > 0
  const usedIncentive = rewards?.first_order_incentive_used
  if (hasOrders || usedIncentive || dismissed) return null
  if (!allProducts) return null

  const truckWashProducts = allProducts.filter(
    (p) => TRUCK_WASH_SLUGS.includes(p.slug) && p.in_stock
  )
  const cartProductSlugs = cartItems?.map((i) => i.product.slug) ?? []

  function handleOptionClick(option: FirstOrderChoice) {
    if (chosen === option) {
      setChosen(null)
      if (option === "half_price_truck_wash") setChosenTW(null)
    } else {
      setChosen(option)
      if (option !== "half_price_truck_wash") setChosenTW(null)
    }
  }

  function handleTruckWashSelect(slug: string) {
    setChosenTW(chosenTW === slug ? null : slug)
  }

  function handleRemoveFromCart(slug: string) {
    const cartItem = cartItems?.find(i => i.product.slug === slug)
    if (!cartItem) return
    setRemovingSlug(slug)
    removeCartItem.mutate(cartItem.id, {
      onSettled: () => setRemovingSlug(null),
    })
    if (chosenTW === slug) setChosenTW(null)
  }

  async function handleAddTruckWash(product: (typeof truckWashProducts)[0]) {
    setAddingSlug(product.slug)
    try {
      await addToCart.mutateAsync({
        product_id: product.id,
        quantity: 1,
        packaging_size: product.packaging_sizes?.[product.packaging_sizes.length - 1] ?? "1000L IBC",
      })
      setChosenTW(product.slug)
      setAddedSlug(product.slug)
      toast.success(`${product.name} added at 50% off!`)
      setTimeout(() => setAddedSlug(null), 3000)
    } catch {
      toast.error("Failed to add product.")
    } finally {
      setAddingSlug(null)
    }
  }

  return (
    <Card className={cn("relative overflow-hidden border-primary/25 bg-primary/5", className)}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2.5 top-2.5 z-10 rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      <CardContent className="p-0">
        {/* Compact header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-primary/10">
          <Gift className="size-4 text-primary shrink-0" />
          <p className="text-xs font-bold">First Order Bonus <span className="font-normal text-muted-foreground">- pick one</span></p>
        </div>

        {/* Options */}
        <div className="p-3 space-y-1.5">
          {/* Option A */}
          <button
            type="button"
            onClick={() => handleOptionClick("free_freight")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
              chosen === "free_freight"
                ? "border-sky-400/40 bg-sky-400/10"
                : "border-white/5 bg-background/50 hover:border-sky-400/20"
            )}
          >
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", chosen === "free_freight" ? "bg-sky-400/20" : "bg-muted/30")}>
              <Truck className={cn("size-4", chosen === "free_freight" ? "text-sky-400" : "text-muted-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Free Freight</p>
              <p className="text-[11px] text-muted-foreground">All shipping fees waived on this order</p>
            </div>
            <div className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors", chosen === "free_freight" ? "border-sky-400 bg-sky-400" : "border-white/20")}>
              {chosen === "free_freight" && <Check className="size-2.5 text-white" />}
            </div>
          </button>

          {/* Option B */}
          <button
            type="button"
            onClick={() => handleOptionClick("half_price_truck_wash")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
              chosen === "half_price_truck_wash"
                ? "border-violet-400/40 bg-violet-400/10"
                : "border-white/5 bg-background/50 hover:border-violet-400/20"
            )}
          >
            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", chosen === "half_price_truck_wash" ? "bg-violet-400/20" : "bg-muted/30")}>
              <FlaskConical className={cn("size-4", chosen === "half_price_truck_wash" ? "text-violet-400" : "text-muted-foreground")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">50% Off Truck Wash</p>
              <p className="text-[11px] text-muted-foreground">Pick one truck wash at half price</p>
            </div>
            <div className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors", chosen === "half_price_truck_wash" ? "border-violet-400 bg-violet-400" : "border-white/20")}>
              {chosen === "half_price_truck_wash" && <Check className="size-2.5 text-white" />}
            </div>
          </button>

          {/* Truck wash picker - inline, compact */}
          {chosen === "half_price_truck_wash" && truckWashProducts.length > 0 && (() => {
            // Check if ANY truck wash is already in cart from this offer
            const twInCart = truckWashProducts.filter(p => cartProductSlugs.includes(p.slug))
            const otherTWAlreadyInCart = (slug: string) => twInCart.some(p => p.slug !== slug)

            return (
              <div className="ml-10.5 space-y-1 pt-1">
                {truckWashProducts.map((product) => {
                  const discounted = product.price * 0.5
                  const isInCart = cartProductSlugs.includes(product.slug)
                  const isSelected = chosenTW === product.slug
                  const isAdding = addingSlug === product.slug
                  const isAdded = addedSlug === product.slug
                  // Can only add if the OTHER truck wash is NOT already in cart
                  const canAdd = !isInCart && !otherTWAlreadyInCart(product.slug)

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleTruckWashSelect(product.slug)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer",
                        isSelected ? "border-violet-400/30 bg-violet-400/5" : "border-white/5 bg-background/30 hover:border-violet-400/20"
                      )}
                    >
                      <div className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isSelected ? "border-violet-400 bg-violet-400" : "border-white/20"
                      )}>
                        {isSelected && <Check className="size-2.5 text-white" />}
                      </div>
                      <div className="relative size-8 shrink-0 overflow-hidden rounded bg-white">
                        <Image src={product.image_url || "/images/cqvs-logo.png"} alt={product.name} fill sizes="32px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{product.name}</p>
                        <div className="flex items-center gap-1.5">
                          {isSelected ? (
                            <>
                              <span className="text-[10px] text-muted-foreground line-through">${product.price.toFixed(2)}</span>
                              <span className="text-xs font-bold text-primary">${discounted.toFixed(2)}/{product.unit}</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">${product.price.toFixed(2)}/{product.unit}</span>
                          )}
                        </div>
                      </div>
                      {isInCart ? (
                        <span
                          role="button"
                          className="flex h-6 items-center gap-0.5 rounded px-2 text-[10px] font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromCart(product.slug) }}
                        >
                          {removingSlug === product.slug ? <Loader2 className="size-3 animate-spin" /> : <><X className="mr-0.5 size-2.5" />Remove</>}
                        </span>
                      ) : canAdd ? (
                        <span
                          role="button"
                          className="flex h-6 items-center gap-0.5 rounded px-2 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleAddTruckWash(product) }}
                        >
                          {isAdding ? <Loader2 className="size-3 animate-spin" /> : isAdded ? <Check className="size-3" /> : <><ShoppingCart className="mr-0.5 size-2.5" />Add</>}
                        </span>
                      ) : (
                        <span
                          role="button"
                          className="flex h-6 items-center gap-0.5 rounded px-2 text-[10px] font-medium text-amber-400 hover:bg-amber-400/10 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            const otherSlug = TRUCK_WASH_SLUGS.find(s => s !== product.slug && cartProductSlugs.includes(s))
                            if (otherSlug) handleRemoveFromCart(otherSlug)
                          }}
                        >
                          <X className="mr-0.5 size-2.5" />Swap
                        </span>
                      )}
                    </button>
                  )
                })}
                {!chosenTW && (
                  <p className="text-[10px] text-amber-400 pl-6">Select which one gets 50% off</p>
                )}
              </div>
            )
          })()}
        </div>

        {/* Footer - only if something is selected */}
        {chosen && (
          <div className="border-t border-primary/10 bg-primary/5 px-4 py-2">
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              {chosen === "free_freight"
                ? "Shipping fees removed at checkout."
                : chosenTW
                  ? `50% off ${truckWashProducts.find(p => p.slug === chosenTW)?.name} at checkout.`
                  : "Pick a truck wash above."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
