"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Check,
  CreditCard,
  FileText,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  ShoppingCart,
} from "lucide-react"
import { toast } from "sonner"
import { domAnimation, LazyMotion, m } from "framer-motion"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useCart, type CartItem } from "@/lib/hooks/use-cart"
import {
  useCreateOrder,
  useConfirmPayment,
  type Order,
} from "@/lib/hooks/use-orders"
import { useProfile } from "@/lib/hooks/use-profile"
import { getStripe } from "@/lib/stripe-client"

const AU_STATES = [
  { label: "New South Wales", value: "NSW" },
  { label: "Victoria", value: "VIC" },
  { label: "Queensland", value: "QLD" },
  { label: "South Australia", value: "SA" },
  { label: "Western Australia", value: "WA" },
  { label: "Tasmania", value: "TAS" },
  { label: "Northern Territory", value: "NT" },
  { label: "Australian Capital Territory", value: "ACT" },
]

const STEP_LABELS = ["Delivery Details", "Payment", "Review & Place Order"]

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface DeliveryAddress {
  street: string
  city: string
  state: string
  postcode: string
  notes: string
}

interface CheckoutFormProps {
  cartItems: CartItem[]
  subtotal: number
  shipping: number
  gst: number
  total: number
  clientSecret: string | null
  orderId: string | null
  onOrderCreated: (order: Order) => void
}

// ----------------------------------------------------------------
// Inner form - must be rendered inside <Elements> so hooks work
// ----------------------------------------------------------------
function CheckoutForm({
  cartItems,
  subtotal,
  shipping,
  gst,
  total,
  clientSecret,
  orderId,
  onOrderCreated,
}: CheckoutFormProps) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const createOrder = useCreateOrder()
  const confirmPayment = useConfirmPayment()

  const { data: profile } = useProfile()

  const [step, setStep] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<
    "stripe" | "purchase_order"
  >("purchase_order")
  const [poNumber, setPoNumber] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stripeReady, setStripeReady] = useState(false)

  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    city: "",
    state: "",
    postcode: "",
    notes: "",
  })

  // Pre-fill from profile
  useEffect(() => {
    if (profile) {
      setAddress((prev) => ({
        street: profile.address_street || prev.street,
        city: profile.address_city || prev.city,
        state: profile.address_state || prev.state,
        postcode: profile.address_postcode || prev.postcode,
        notes: prev.notes,
      }))
    }
  }, [profile])

  const updateAddress = useCallback(
    (field: keyof DeliveryAddress, value: string) => {
      setAddress((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  // ------- Validation -------
  const isDeliveryValid = useMemo(
    () =>
      address.street.trim() !== "" &&
      address.city.trim() !== "" &&
      address.state !== "" &&
      address.postcode.trim() !== "",
    [address]
  )

  const isPaymentValid = useMemo(() => {
    if (paymentMethod === "purchase_order") return poNumber.trim() !== ""
    // For stripe we need stripe + elements ready + client secret
    return stripeReady
  }, [paymentMethod, poNumber, stripeReady])

  // ------- Step navigation -------
  const goNext = useCallback(async () => {
    if (step === 0) {
      if (!isDeliveryValid) {
        toast.error("Please fill in all required delivery fields.")
        return
      }
      setStep(1)
      return
    }

    if (step === 1) {
      if (!isPaymentValid) {
        if (paymentMethod === "purchase_order") {
          toast.error("Please enter a purchase order number.")
        } else {
          toast.error("Please complete the payment details.")
        }
        return
      }

      setStep(2)
      return
    }
  }, [
    step,
    isDeliveryValid,
    isPaymentValid,
    paymentMethod,
    orderId,
    address,
    createOrder,
    onOrderCreated,
  ])

  const goBack = useCallback(() => {
    if (step > 0) setStep(step - 1)
  }, [step])

  // ------- Submit order -------
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)

    try {
      if (paymentMethod === "purchase_order") {
        // PO flow - create order directly
        await createOrder.mutateAsync({
          payment_method: "purchase_order",
          po_number: poNumber,
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            packaging_size: item.packaging_size,
            unit_price: item.product.price,
          })),
          delivery_address_street: address.street,
          delivery_address_city: address.city,
          delivery_address_state: address.state,
          delivery_address_postcode: address.postcode,
          delivery_notes: address.notes,
        })
        toast.success("Order placed successfully!")
        router.push("/dashboard/orders")
        return
      }

      // Stripe flow - create order first, then confirm payment
      if (!stripe || !elements) {
        toast.error("Payment not ready. Please try again.")
        setIsSubmitting(false)
        return
      }

      // Step 1: Submit elements to validate card details
      const { error: submitError } = await elements.submit()
      if (submitError) {
        toast.error("Please check your card details and try again.")
        setIsSubmitting(false)
        return
      }

      // Step 2: Create order to get client_secret
      let orderResult = orderId ? { id: orderId, client_secret: clientSecret } : null

      if (!orderResult) {
        const order = await createOrder.mutateAsync({
          payment_method: "stripe",
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            packaging_size: item.packaging_size,
            unit_price: item.product.price,
          })),
          delivery_address_street: address.street,
          delivery_address_city: address.city,
          delivery_address_state: address.state,
          delivery_address_postcode: address.postcode,
          delivery_notes: address.notes,
        })
        orderResult = { id: order.id, client_secret: order.client_secret ?? null }
        onOrderCreated(order)
      }

      if (!orderResult.client_secret) {
        toast.error("Failed to initialize payment. Please try again.")
        setIsSubmitting(false)
        return
      }

      // Step 3: Confirm payment with Stripe
      const result = await stripe.confirmPayment({
        elements,
        clientSecret: orderResult.client_secret,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/orders`,
        },
        redirect: "if_required",
      })

      const error = result.error
      const paymentIntent = "paymentIntent" in result ? result.paymentIntent : undefined

      if (error) {
        toast.error("Payment could not be processed. Please check your card details or try a different payment method.")
        setIsSubmitting(false)
        return
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Step 4: Confirm on backend
        await confirmPayment.mutateAsync({
          id: orderResult.id,
          payment_intent_id: paymentIntent.id,
        })
        toast.success("Payment confirmed - order placed successfully!")
        router.push("/dashboard/orders")
      }
    } catch (err) {
      console.error("Checkout error:", err)
      toast.error(
        "Something went wrong while placing your order. Please try again.",
      )
      setIsSubmitting(false)
    }
  }, [
    paymentMethod,
    poNumber,
    address,
    stripe,
    elements,
    clientSecret,
    orderId,
    createOrder,
    confirmPayment,
    router,
  ])

  // ------- Render -------
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cart">
            <ArrowLeft className="mr-1 size-4" />
            Cart
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
      </div>

      {/* Step Indicators */}
      <div className="mb-10 flex items-center justify-center gap-0">
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  index < step
                    ? "bg-primary text-primary-foreground"
                    : index === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index < step ? (
                  <Check className="size-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`hidden text-sm font-medium sm:inline ${
                  index <= step
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEP_LABELS.length - 1 && (
              <div
                className={`mx-4 h-px w-12 sm:w-20 transition-colors ${
                  index < step ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Column */}
        <div className="lg:col-span-2">
          <div>
            {/* Step 0 - Delivery Details */}
            {step === 0 && (
              <m.div
                key="delivery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="size-5" />
                      Delivery Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="street">
                        Street Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="street"
                        placeholder="42 Industrial Drive"
                        className="h-10"
                        value={address.street}
                        onChange={(e) =>
                          updateAddress("street", e.target.value)
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="city">
                          City <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="city"
                          placeholder="Rockhampton"
                          className="h-10"
                          value={address.city}
                          onChange={(e) =>
                            updateAddress("city", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">
                          State <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={address.state}
                          onValueChange={(v) => updateAddress("state", v)}
                        >
                          <SelectTrigger id="state" className="h-10 w-full">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {AU_STATES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="postcode">
                          Postcode <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="postcode"
                          placeholder="4700"
                          className="h-10"
                          value={address.postcode}
                          onChange={(e) =>
                            updateAddress("postcode", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Delivery Notes</Label>
                      <textarea
                        id="notes"
                        rows={3}
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder="Call on arrival, forklift available, etc."
                        value={address.notes}
                        onChange={(e) =>
                          updateAddress("notes", e.target.value)
                        }
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={goNext}
                        disabled={!isDeliveryValid}
                        className="glow-primary"
                      >
                        Continue to Payment
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </m.div>
            )}

            {/* Step 1 - Payment (kept mounted but hidden so Stripe Elements stay alive) */}
            <div className={step === 1 ? "" : "hidden"}>
              <m.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="size-5" />
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Payment Toggle */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("stripe")}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                          paymentMethod === "stripe"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <CreditCard className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Card Payment</p>
                          <p className="text-xs text-muted-foreground">
                            Visa, Mastercard, Amex
                          </p>
                        </div>
                        {paymentMethod === "stripe" && (
                          <Check className="ml-auto size-4 text-primary" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("purchase_order")}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                          paymentMethod === "purchase_order"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <FileText className="size-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Purchase Order</p>
                          <p className="text-xs text-muted-foreground">
                            Pay on account terms
                          </p>
                        </div>
                        {paymentMethod === "purchase_order" && (
                          <Check className="ml-auto size-4 text-primary" />
                        )}
                      </button>
                    </div>

                    {/* Stripe Payment Element */}
                    {paymentMethod === "stripe" && (
                      <div className="pt-2">
                        <div className="rounded-lg border border-border p-4">
                          <PaymentElement
                            onReady={() => setStripeReady(true)}
                            options={{
                              layout: "tabs",
                            }}
                          />
                        </div>
                        {false && (
                          <div className="flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8">
                            <div className="text-center">
                              <Loader2 className="mx-auto mb-3 size-6 animate-spin text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">
                                Payment form will load in the next step
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PO Number Input */}
                    {paymentMethod === "purchase_order" && (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor="po-number">
                          Purchase Order Number{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="po-number"
                          placeholder="PO-2026-00482"
                          className="h-10"
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="flex justify-between pt-2">
                      <Button variant="ghost" onClick={goBack}>
                        <ArrowLeft className="mr-2 size-4" />
                        Back
                      </Button>
                      <Button
                        onClick={goNext}
                        disabled={
                          !isPaymentValid ||
                          isSubmitting
                        }
                        className="glow-primary"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Review Order
                            <ArrowRight className="ml-2 size-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </m.div>
            </div>

            {/* Step 2 - Review */}
            {step === 2 && (
              <m.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Delivery Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="size-5" />
                      Delivery Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {address.street}
                      </p>
                      <p>
                        {address.city},{" "}
                        {AU_STATES.find((s) => s.value === address.state)
                          ?.label || address.state}{" "}
                        {address.postcode}
                      </p>
                      {address.notes && (
                        <p className="mt-2 italic">
                          Notes: {address.notes}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {paymentMethod === "stripe" ? (
                        <CreditCard className="size-5" />
                      ) : (
                        <FileText className="size-5" />
                      )}
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {paymentMethod === "stripe" ? (
                        <p>Card Payment via Stripe</p>
                      ) : (
                        <p>
                          Purchase Order -{" "}
                          <span className="font-medium text-foreground">
                            {poNumber}
                          </span>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Items Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="size-5" />
                      Order Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={
                              item.product.image_url ||
                              "/images/cqvs-logo.png"
                            }
                            alt={item.product.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x {item.packaging_size} @{" "}
                            {formatCurrency(item.product.price)}/
                            {item.product.unit}
                          </p>
                        </div>
                        <span className="font-medium">
                          {formatCurrency(
                            item.product.price * item.quantity
                          )}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={goBack}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    size="lg"
                    className="glow-primary"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>Place Order - {formatCurrency(total)}</>
                    )}
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  By placing this order you agree to our Terms of Service and
                  Shipping Policy.
                </p>
              </m.div>
            )}
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Line Items */}
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x {item.packaging_size}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 font-medium">
                      {formatCurrency(item.product.price * item.quantity)}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Loading skeleton for the checkout page
// ----------------------------------------------------------------
function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="mb-8 h-9 w-40" />
      <div className="mb-10 flex items-center justify-center gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="hidden sm:block h-4 w-24" />
            {i < 3 && <Skeleton className="mx-4 h-px w-12 sm:w-20" />}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
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
  )
}

// ----------------------------------------------------------------
// Outer page component - wraps with Stripe Elements provider
// ----------------------------------------------------------------
export default function CheckoutPage() {
  const { data: cartItems, isLoading } = useCart()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const items = cartItems ?? []

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )
  const shipping = 0
  const gst = (subtotal + shipping) * 0.1
  const total = subtotal + shipping + gst

  const handleOrderCreated = useCallback((order: Order) => {
    if (order.id) {
      setOrderId(order.id)
    }
    // The API returns client_secret for stripe orders
    const secret = (order as Order & { client_secret?: string }).client_secret
    if (secret) {
      setClientSecret(secret)
    }
  }, [])

  const stripeOptions = useMemo(() => {
    if (!clientSecret) return undefined
    return {
      clientSecret,
      appearance: {
        theme: "night" as const,
        variables: {
          colorPrimary: "#3b82f6",
          borderRadius: "8px",
        },
      },
    }
  }, [clientSecret])

  if (isLoading) {
    return (
      <LazyMotion features={domAnimation} strict>
        <CheckoutSkeleton />
      </LazyMotion>
    )
  }

  if (items.length === 0) {
    return (
      <LazyMotion features={domAnimation} strict>
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <h1 className="mb-8 text-3xl font-bold tracking-tight">
              Checkout
            </h1>
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingCart className="mb-4 size-10 text-muted-foreground" />
                <h3 className="mb-1.5 text-lg font-semibold">
                  Your cart is empty
                </h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  Add some products before checking out.
                </p>
                <Button asChild>
                  <Link href="/products">Browse Products</Link>
                </Button>
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
        <Elements
          stripe={getStripe()}
          options={
            stripeOptions || {
              mode: "payment" as const,
              amount: Math.max(50, Math.round(total * 100)),
              currency: "aud",
              appearance: {
                theme: "night" as const,
                variables: {
                  colorPrimary: "#3b82f6",
                  borderRadius: "8px",
                },
              },
            }
          }
        >
          <CheckoutForm
            cartItems={items}
            subtotal={subtotal}
            shipping={shipping}
            gst={gst}
            total={total}
            clientSecret={clientSecret}
            orderId={orderId}
            onOrderCreated={handleOrderCreated}
          />
        </Elements>
      </m.div>
    </LazyMotion>
  )
}
