"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, CreditCard, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageTransition } from "@/components/shared/page-transition"

const steps = [
  { label: "Delivery Details", active: true },
  { label: "Payment", active: false },
  { label: "Review", active: false },
]

const orderItems = [
  { name: "Green Acid Replacement", qty: "2x 1000L IBC", total: 4900 },
  { name: "AdBlue (DEF)", qty: "4x 1000L IBC", total: 4600 },
  { name: "Truck Wash Premium", qty: "1x 200L Drum", total: 390 },
]

const australianStates = [
  "New South Wales",
  "Victoria",
  "Queensland",
  "South Australia",
  "Western Australia",
  "Tasmania",
  "Northern Territory",
  "Australian Capital Territory",
]

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CheckoutPage() {
  const [paymentMethod, setPaymentMethod] = useState<"invoice" | "card">("invoice")

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const shipping = 0
  const gst = (subtotal + shipping) * 0.1
  const total = subtotal + shipping + gst

  function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault()
    toast.success("Order placed successfully!")
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        </div>

        {/* Step Indicators */}
        <div className="mb-10 flex items-center justify-center gap-0">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                    step.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <span
                  className={`text-sm font-medium ${
                    step.active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="mx-4 h-px w-12 bg-border sm:w-20" />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handlePlaceOrder}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Forms Column */}
            <div className="space-y-6 lg:col-span-2">
              {/* Delivery Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        defaultValue="CQVS Pty Ltd"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Contact Name</Label>
                      <Input
                        id="contact-name"
                        defaultValue="James Wilson"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        defaultValue="07 4927 8800"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        defaultValue="orders@cqvs.com.au"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">Delivery Address</Label>
                      <Input
                        id="address"
                        defaultValue="42 Industrial Drive"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        defaultValue="Rockhampton"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Select defaultValue="Queensland">
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {australianStates.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        defaultValue="4700"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="notes">Delivery Notes</Label>
                      <textarea
                        id="notes"
                        rows={3}
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue="Please call on arrival. Forklift available on site."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Payment Options */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("invoice")}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                        paymentMethod === "invoice"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <FileText className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Invoice / Purchase Order</p>
                        <p className="text-xs text-muted-foreground">
                          Pay on account terms
                        </p>
                      </div>
                      {paymentMethod === "invoice" && (
                        <Check className="ml-auto size-4 text-primary" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                        paymentMethod === "card"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <CreditCard className="size-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Pay by Card</p>
                        <p className="text-xs text-muted-foreground">
                          Visa, Mastercard, Amex
                        </p>
                      </div>
                      {paymentMethod === "card" && (
                        <Check className="ml-auto size-4 text-primary" />
                      )}
                    </button>
                  </div>

                  {/* Invoice Details */}
                  {paymentMethod === "invoice" && (
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="po-number">Purchase Order Number</Label>
                      <Input
                        id="po-number"
                        placeholder="PO-2026-00482"
                        className="h-10"
                      />
                    </div>
                  )}

                  {/* Card Placeholder */}
                  {paymentMethod === "card" && (
                    <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
                      <CreditCard className="mx-auto mb-3 size-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Stripe payment integration coming soon
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Secure card payments powered by Stripe
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Sidebar */}
            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Line items */}
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-start justify-between text-sm"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.qty}
                          </p>
                        </div>
                        <span className="font-medium">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-xs font-medium text-primary">Free</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST (10%)</span>
                      <span>{formatCurrency(gst)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-base font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full glow-primary"
                    size="lg"
                  >
                    Place Order
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    By placing this order you agree to our Terms of Service and
                    Shipping Policy.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </PageTransition>
  )
}
