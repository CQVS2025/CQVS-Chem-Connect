"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, ShoppingCart, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageTransition } from "@/components/shared/page-transition"

interface CartItem {
  id: number
  name: string
  quantity: number
  packaging: string
  unitPrice: number
  unit: string
  image: string
}

const initialCartItems: CartItem[] = [
  {
    id: 1,
    name: "Green Acid Replacement",
    quantity: 2,
    packaging: "1000L IBC",
    unitPrice: 2.45,
    unit: "L",
    image: "/images/placeholder-product.png",
  },
  {
    id: 2,
    name: "AdBlue (DEF)",
    quantity: 4,
    packaging: "1000L IBC",
    unitPrice: 1.15,
    unit: "L",
    image: "/images/placeholder-product.png",
  },
  {
    id: 3,
    name: "Truck Wash Premium",
    quantity: 1,
    packaging: "200L Drum",
    unitPrice: 1.95,
    unit: "L",
    image: "/images/placeholder-product.png",
  },
]

function getPackagingVolume(packaging: string): number {
  const match = packaging.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 1
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems)

  function updateQuantity(id: number, delta: number) {
    setCartItems((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    )
  }

  function removeItem(id: number) {
    setCartItems((items) => items.filter((item) => item.id !== id))
  }

  function getSubtotal(item: CartItem) {
    return item.unitPrice * getPackagingVolume(item.packaging) * item.quantity
  }

  const subtotal = cartItems.reduce((sum, item) => sum + getSubtotal(item), 0)
  const shippingFree = subtotal >= 5000
  const shipping = shippingFree ? 0 : 150
  const gst = (subtotal + shipping) * 0.1
  const total = subtotal + shipping + gst

  if (cartItems.length === 0) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Shopping Cart</h1>
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
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Shopping Cart</h1>
          <p className="mt-2 text-muted-foreground">
            {cartItems.length} {cartItems.length === 1 ? "item" : "items"} in
            your cart
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="space-y-4 lg:col-span-2">
            {cartItems.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Product Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="hidden sm:block h-16 w-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ShoppingCart className="size-6" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">
                        {item.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{item.packaging}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.unitPrice)}/{item.unit}
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
                        onClick={() => updateQuantity(item.id, -1)}
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
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>

                    {/* Subtotal */}
                    <span className="w-24 text-right text-sm font-semibold">
                      {formatCurrency(getSubtotal(item))}
                    </span>

                    {/* Remove */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {shippingFree ? (
                      <Badge variant="secondary" className="text-xs">
                        Free
                      </Badge>
                    ) : (
                      formatCurrency(shipping)
                    )}
                  </span>
                </div>
                {!shippingFree && (
                  <p className="text-xs text-muted-foreground">
                    Free shipping on orders over $5,000
                  </p>
                )}
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
                  <Link href="/checkout">Proceed to Checkout</Link>
                </Button>
                <Button variant="ghost" className="w-full" asChild>
                  <Link href="/products">Continue Shopping</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
