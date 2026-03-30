"use client"

import { useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, ShoppingCart, Trash2, ArrowRight, Package } from "lucide-react"
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
import { useBundles } from "@/lib/hooks/use-rewards"
import {
  detectQualifiedBundles,
  buildItemDiscountMap,
  calculateBundleDiscount,
} from "@/lib/utils/bundle-detection"

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
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

  const lineTotal = item.product.price * item.quantity

  const handleQuantityChange = useCallback(
    (delta: number) => {
      const newQty = Math.max(1, item.quantity + delta)
      if (newQty !== item.quantity) {
        updateCartItem.mutate({ id: item.id, quantity: newQty })
      }
    },
    [item.id, item.quantity, updateCartItem]
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
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(item.product.price)}/{item.product.unit}
                </span>
              </div>
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
                disabled={item.quantity <= 1 || updateCartItem.isPending}
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
          unit_price: i.product.price,
        }))
      ),
    [discountMap, items]
  )

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )
  const shipping = items.reduce(
    (sum, item) => sum + (item.product.shipping_fee ?? 0),
    0,
  )
  const gst = (subtotal - bundleDiscount + shipping) * 0.1
  const total = subtotal - bundleDiscount + shipping + gst

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
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>
                        {shipping === 0 ? (
                          <Badge variant="secondary" className="text-xs">
                            Free
                          </Badge>
                        ) : (
                          formatCurrency(shipping)
                        )}
                      </span>
                    </div>
                    {shipping > 0 && (
                      <div className="space-y-1 pl-2 border-l-2 border-border">
                        {items.map((item) => (
                          <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate max-w-32">{item.product.name}</span>
                            <span className="shrink-0">
                              {(item.product.shipping_fee ?? 0) > 0
                                ? formatCurrency(item.product.shipping_fee)
                                : "Free"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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
                  <Button className="w-full glow-primary" size="lg" asChild>
                    <Link href="/checkout">
                      Proceed to Checkout
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
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
