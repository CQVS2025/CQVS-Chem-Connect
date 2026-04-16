"use client"

import { useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, ShoppingCart, Trash2, ArrowRight, Package, AlertCircle } from "lucide-react"
import { domAnimation, LazyMotion, m, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import {
  useCart,
  useUpdateCartItem,
  useRemoveCartItem,
  type CartItem,
} from "@/lib/hooks/use-cart"
import { useBundles, useRewards, usePromotions } from "@/lib/hooks/use-rewards"
import { useOrders } from "@/lib/hooks/use-orders"
import { FirstOrderOffer } from "@/components/features/first-order-offer"
import { useFirstOrderChoice } from "@/lib/hooks/use-first-order-choice"
import {
  detectQualifiedBundles,
  buildItemDiscountMap,
  calculateBundleDiscount,
} from "@/lib/utils/bundle-detection"
import {
  detectActivePromotions,
  calculatePromotionDiscount,
  hasPromotionFreeFreight,
} from "@/lib/utils/promotion-detection"
import { calculateUnitPrice } from "@/lib/pricing"

function formatCurrency(amount: number) {
  return `AUD ${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Resolve the unit price for a cart item using the new packaging-prices model
 * if available, otherwise fall back to the legacy product.price.
 */
function resolveCartMoq(item: CartItem): number {
  const prices = item.product.packaging_prices
  if (!prices || prices.length === 0) return 1
  const match =
    prices.find((p) => p.packaging_size_id === item.packaging_size_id) ??
    prices.find((p) => p.packaging_size?.name === item.packaging_size)
  return match?.minimum_order_quantity ?? 1
}

function resolveCartUnitPrice(item: CartItem): number {
  const prices = item.product.packaging_prices
  if (!prices || prices.length === 0) return Number(item.product.price) || 0

  // Match by id first, then by name
  const match =
    prices.find((p) => p.packaging_size_id === item.packaging_size_id) ??
    prices.find((p) => p.packaging_size?.name === item.packaging_size)

  if (!match) return Number(item.product.price) || 0

  return calculateUnitPrice(
    item.product.price_type,
    match,
    match.packaging_size,
  )
}

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="hidden sm:block h-16 w-16 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CartItemRow({
  item,
  index,
}: {
  item: CartItem
  index: number
}) {
  const updateCartItem = useUpdateCartItem()
  const removeCartItem = useRemoveCartItem()

  const unitPrice = resolveCartUnitPrice(item)
  const moq = resolveCartMoq(item)
  const lineTotal = unitPrice * item.quantity
  const belowMoq = item.quantity < moq

  const handleQuantityChange = useCallback(
    (delta: number) => {
      const newQty = Math.max(moq, item.quantity + delta)
      if (newQty !== item.quantity) {
        updateCartItem.mutate({ id: item.id, quantity: newQty })
      }
    },
    [item.id, item.quantity, moq, updateCartItem]
  )

  const handleRemove = useCallback(() => {
    removeCartItem.mutate(item.id)
  }, [item.id, removeCartItem])

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      layout
    >
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Product Info */}
          <div className="flex items-center gap-4 flex-1">
            <div className="hidden sm:block relative h-16 w-16 rounded-lg bg-muted shrink-0 overflow-hidden">
              <Image
                src={item.product.image_url || "/images/cqvs-logo.png"}
                alt={item.product.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/products/${item.product.slug}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {item.product.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.packaging_size}</Badge>
                {moq > 1 && (
                  <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-500 bg-amber-500/5">
                    Min. {moq}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(unitPrice)} each
                </span>
              </div>
              {belowMoq && (
                <div className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  Minimum order is {moq} units — please increase quantity before checkout.
                </div>
              )}
            </div>
          </div>

          {/* Quantity and Actions */}
          <div className="flex items-center gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center rounded-lg border">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={item.quantity <= moq || updateCartItem.isPending}
                onClick={() => handleQuantityChange(-1)}
              >
                <Minus className="size-3.5" />
              </Button>
              <span className="w-10 text-center text-sm font-medium">
                {item.quantity}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={updateCartItem.isPending}
                onClick={() => handleQuantityChange(1)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            {/* Line Total */}
            <span className="w-24 text-right text-sm font-semibold">
              {formatCurrency(lineTotal)}
            </span>

            {/* Remove */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              disabled={removeCartItem.isPending}
              onClick={handleRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </m.div>
  )
}

export default function CartPage() {
  const { data: cartItems, isLoading } = useCart()
  const { data: bundles } = useBundles()
  const { data: orders } = useOrders()
  const { data: rewards } = useRewards()

  const items = cartItems ?? []

  // Bundle detection - must be called unconditionally (hooks rules)
  const cartProductIds = items.map((i) => i.product.id)
  const qualifiedBundles = useMemo(
    () => detectQualifiedBundles(bundles ?? [], cartProductIds),
    [bundles, cartProductIds]
  )
  const discountMap = useMemo(
    () => buildItemDiscountMap(qualifiedBundles),
    [qualifiedBundles]
  )
  const bundleDiscount = useMemo(
    () =>
      calculateBundleDiscount(
        discountMap,
        items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: resolveCartUnitPrice(i),
        }))
      ),
    [discountMap, items]
  )

  // First-order option - persisted in sessionStorage across cart/checkout
  const isFirstOrder = !orders?.length && !rewards?.first_order_incentive_used
  const { option: firstOrderChoice, truckWash: selectedTruckWash, setOption: setFirstOrderChoice, setTruckWash: setSelectedTruckWash } = useFirstOrderChoice()

  // Resolve unit prices for all items using new pricing model
  const itemsWithPricing = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        resolvedUnitPrice: resolveCartUnitPrice(item),
      })),
    [items],
  )

  const truckWashDiscount = useMemo(() => {
    if (!isFirstOrder || firstOrderChoice !== "half_price_truck_wash" || !selectedTruckWash) return 0
    const twItem = itemsWithPricing.find((i) => i.product.slug === selectedTruckWash)
    if (!twItem) return 0
    return Math.round(twItem.resolvedUnitPrice * twItem.quantity * 0.5 * 100) / 100
  }, [isFirstOrder, firstOrderChoice, selectedTruckWash, itemsWithPricing])

  const moqViolations = useMemo(
    () => items.filter((item) => item.quantity < resolveCartMoq(item)),
    [items],
  )
  const hasMoqViolation = moqViolations.length > 0

  const subtotal = itemsWithPricing.reduce(
    (sum, item) => sum + item.resolvedUnitPrice * item.quantity,
    0,
  )

  // Promotion detection
  const { data: promotions } = usePromotions()
  const subtotalAfterBundles = subtotal - bundleDiscount - truckWashDiscount
  const qualifiedPromos = useMemo(
    () => detectActivePromotions(
      promotions ?? [],
      itemsWithPricing.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.resolvedUnitPrice,
        shipping_fee: 0,
      })),
      subtotalAfterBundles
    ),
    [promotions, itemsWithPricing, subtotalAfterBundles]
  )
  const promoDiscount = useMemo(() => calculatePromotionDiscount(qualifiedPromos), [qualifiedPromos])
  const promoFreeFreight = useMemo(() => hasPromotionFreeFreight(qualifiedPromos), [qualifiedPromos])

  // Shipping is now calculated at checkout via MacShip - cart shows placeholder
  const totalDiscount = bundleDiscount + truckWashDiscount + promoDiscount
  const gst = Math.round((subtotal - totalDiscount) * 0.1 * 100) / 100
  const total = subtotal - totalDiscount + gst

  if (isLoading) {
    return (
      <LazyMotion features={domAnimation} strict>
        <CartSkeleton />
      </LazyMotion>
    )
  }

  if (items.length === 0) {
    return (
      <LazyMotion features={domAnimation} strict>
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">
                Shopping Cart
              </h1>
            </div>
            <Card>
              <CardContent>
                <EmptyState
                  icon={ShoppingCart}
                  title="Your cart is empty"
                  description="Browse our catalog to find the chemicals and products you need."
                  action={
                    <Button asChild>
                      <Link href="/products">Browse Products</Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </div>
        </m.div>
      </LazyMotion>
    )
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              Shopping Cart
            </h1>
            <p className="mt-2 text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"} in your
              cart
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* First Order Offer */}
            {isFirstOrder && (
              <FirstOrderOffer
                className="mb-4"
                selectedOption={firstOrderChoice}
                onSelectOption={setFirstOrderChoice}
                selectedTruckWash={selectedTruckWash}
                onSelectTruckWash={setSelectedTruckWash}
              />
            )}

            {/* Cart Items */}
            <div className="space-y-4 lg:col-span-2">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => (
                  <CartItemRow key={item.id} item={item} index={index} />
                ))}
              </AnimatePresence>
            </div>

            {/* Order Summary Sidebar */}
            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {/* Bundle Discount */}
                  {bundleDiscount > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-primary">
                          <Package className="size-3.5" />
                          Bundle Discount
                        </span>
                        <span className="font-medium text-primary">
                          -{formatCurrency(bundleDiscount)}
                        </span>
                      </div>
                      <div className="space-y-1 pl-2 border-l-2 border-primary/20">
                        {qualifiedBundles.map((qb) => (
                          <div key={qb.bundleId} className="text-xs text-primary/80">
                            {qb.bundleName} ({qb.discountPercent}% off {qb.qualifyingProductIds.length} items)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* First Order Truck Wash Discount */}
                  {truckWashDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-primary">First Order - 50% Off Truck Wash</span>
                      <span className="font-medium text-primary">-{formatCurrency(truckWashDiscount)}</span>
                    </div>
                  )}
                  {/* Promotion Discounts */}
                  {qualifiedPromos.filter(p => p.discountAmount > 0).map(p => (
                    <div key={p.promotionId} className="flex justify-between text-sm">
                      <span className="text-violet-400 truncate max-w-48">{p.label}</span>
                      <span className="font-medium text-violet-400">-{formatCurrency(p.discountAmount)}</span>
                    </div>
                  ))}
                  {/* Bonus credit info (not deducted) */}
                  {qualifiedPromos.filter(p => p.bonusCreditPercent > 0).map(p => (
                    <div key={p.promotionId} className="flex justify-between text-sm">
                      <span className="text-amber-400 truncate max-w-48">{p.label}</span>
                      <span className="text-xs text-amber-400">+{p.bonusCreditPercent}% credit after order</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-xs italic text-muted-foreground">
                      Calculated at checkout
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST (10%)</span>
                    <span>{formatCurrency(gst)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  {hasMoqViolation && (
                    <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <div className="text-xs text-destructive">
                          <p className="font-medium">Minimum order not met</p>
                          <p className="mt-0.5 text-destructive/80">
                            {moqViolations.length === 1
                              ? `${moqViolations[0].product.name} (${moqViolations[0].packaging_size}) requires a minimum of ${resolveCartMoq(moqViolations[0])} units.`
                              : `${moqViolations.length} items don't meet their minimum order quantity.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full glow-primary"
                    size="lg"
                    disabled={hasMoqViolation}
                    asChild={!hasMoqViolation}
                  >
                    {hasMoqViolation ? (
                      <>
                        Proceed to Checkout
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    ) : (
                      <Link href="/checkout">
                        Proceed to Checkout
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    )}
                  </Button>
                  <Button variant="ghost" className="w-full" asChild>
                    <Link href="/products">Continue Shopping</Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </m.div>
    </LazyMotion>
  )
}
