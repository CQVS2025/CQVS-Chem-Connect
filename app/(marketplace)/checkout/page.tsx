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
  Paperclip,
  ShoppingCart,
  X,
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
import { useBundles, usePromotions } from "@/lib/hooks/use-rewards"
import {
  detectQualifiedBundles,
  buildItemDiscountMap,
  calculateBundleDiscount,
  type QualifiedBundle,
} from "@/lib/utils/bundle-detection"
import {
  detectActivePromotions,
  calculatePromotionDiscount,
  hasPromotionFreeFreight,
  type QualifiedPromotion,
} from "@/lib/utils/promotion-detection"
import {
  useCreateOrder,
  useConfirmPayment,
  type Order,
} from "@/lib/hooks/use-orders"
import { useProfile } from "@/lib/hooks/use-profile"
import { useOrders } from "@/lib/hooks/use-orders"
import { useRewards } from "@/lib/hooks/use-rewards"
import { getStripe } from "@/lib/stripe-client"
import { postForm } from "@/lib/api/client"
import { FirstOrderOffer, type FirstOrderChoice } from "@/components/features/first-order-offer"
import { useFirstOrderChoice } from "@/lib/hooks/use-first-order-choice"
import { useWarehouses, useContainerCosts } from "@/lib/hooks/use-warehouses"
import { calculateUnitPrice } from "@/lib/pricing"

function resolveItemUnitPrice(item: CartItem): number {
  const prices = item.product.packaging_prices
  if (!prices || prices.length === 0) return Number(item.product.price) || 0
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

function uploadOrderDocuments(orderId: string, files: File[]) {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  return postForm(`/orders/${orderId}/documents`, formData)
}

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
  return `AUD ${amount.toLocaleString("en-AU", {
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
  forkliftAvailable: "yes" | "no" | ""
}

interface CheckoutContainerLine {
  packagingSizeId: string
  packagingName: string
  unitCost: number
  quantity: number
  lineCost: number
}

interface CheckoutFormProps {
  cartItems: CartItem[]
  subtotal: number
  shipping: number
  gst: number
  total: number
  containerTotal: number
  containerLines: CheckoutContainerLine[]
  bundleDiscount: number
  firstOrderDiscount: number
  freeFreight: boolean
  rawShipping: number
  promoDiscount: number
  qualifiedPromos: QualifiedPromotion[]
  isFirstOrder: boolean
  firstOrderChoice: FirstOrderChoice
  onFirstOrderChoiceChange: (choice: FirstOrderChoice) => void
  selectedTruckWash: string | null
  onSelectedTruckWashChange: (slug: string | null) => void
  onOrderSuccess: () => void
  qualifiedBundles: QualifiedBundle[]
  clientSecret: string | null
  orderId: string | null
  onOrderCreated: (order: Order) => void
  onDeliveryStateChange: (state: string) => void
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
  containerTotal,
  containerLines,
  bundleDiscount,
  firstOrderDiscount,
  freeFreight,
  rawShipping,
  promoDiscount,
  qualifiedPromos,
  isFirstOrder,
  firstOrderChoice,
  onFirstOrderChoiceChange,
  selectedTruckWash,
  onSelectedTruckWashChange,
  onOrderSuccess,
  qualifiedBundles,
  clientSecret,
  orderId,
  onOrderCreated,
  onDeliveryStateChange,
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
  const [poDocuments, setPoDocuments] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stripeReady, setStripeReady] = useState(false)
  const [cardComplete, setCardComplete] = useState(false)

  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    city: "",
    state: "",
    postcode: "",
    notes: "",
    forkliftAvailable: "",
  })

  const [invoiceEmail, setInvoiceEmail] = useState("")

  // Pre-fill from profile
  useEffect(() => {
    if (profile) {
      setAddress((prev) => ({
        street: profile.address_street || prev.street,
        city: profile.address_city || prev.city,
        state: profile.address_state || prev.state,
        postcode: profile.address_postcode || prev.postcode,
        notes: prev.notes,
        forkliftAvailable: prev.forkliftAvailable,
      }))
      const profileWithExtras = profile as typeof profile & {
        invoice_email?: string | null
      }
      setInvoiceEmail(
        profileWithExtras.invoice_email || profile.email || "",
      )
    }
  }, [profile])

  const updateAddress = useCallback(
    <K extends keyof DeliveryAddress>(field: K, value: DeliveryAddress[K]) => {
      setAddress((prev) => ({ ...prev, [field]: value }))
      if (field === "state" && typeof value === "string") {
        onDeliveryStateChange(value)
      }
    },
    [onDeliveryStateChange]
  )

  // Bubble up state on initial profile load
  useEffect(() => {
    if (address.state) {
      onDeliveryStateChange(address.state)
    }
  }, [address.state, onDeliveryStateChange])

  // ------- Validation -------
  const isDeliveryValid = useMemo(
    () =>
      address.street.trim() !== "" &&
      address.city.trim() !== "" &&
      address.state !== "" &&
      address.postcode.trim() !== "" &&
      address.forkliftAvailable !== "",
    [address]
  )

  const isPaymentValid = useMemo(() => {
    if (paymentMethod === "purchase_order") {
      // PO requires both a number AND at least one uploaded document
      return (
        poNumber.trim() !== "" &&
        poDocuments.length > 0 &&
        invoiceEmail.trim() !== ""
      )
    }
    // Card must be fully filled in (not just rendered)
    return stripeReady && cardComplete
  }, [paymentMethod, poNumber, poDocuments, invoiceEmail, stripeReady, cardComplete])

  // ------- Processing fee (card payments only) -------
  // Stripe fee: 1.75% + $0.30 + 10% GST on the fee
  const processingFee = useMemo(() => {
    if (paymentMethod !== "stripe") return 0
    const beforeFee = subtotal + containerTotal + shipping + gst
    const stripeFee = beforeFee * 0.0175 + 0.30
    const feeGst = stripeFee * 0.10
    return Math.round((stripeFee + feeGst) * 100) / 100
  }, [paymentMethod, subtotal, containerTotal, shipping, gst])

  const totalWithFee = Math.round((total + processingFee) * 100) / 100

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
        const poOrder = await createOrder.mutateAsync({
          payment_method: "purchase_order",
          po_number: poNumber,
          invoice_email: invoiceEmail,
          forklift_available: address.forkliftAvailable === "yes",
          first_order_choice: firstOrderChoice,
          first_order_truck_wash: selectedTruckWash,
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            packaging_size: item.packaging_size,
            packaging_size_id: item.packaging_size_id,
            unit_price: resolveItemUnitPrice(item),
          })),
          delivery_address_street: address.street,
          delivery_address_city: address.city,
          delivery_address_state: address.state,
          delivery_address_postcode: address.postcode,
          delivery_notes: address.notes,
        })

        // Upload PO documents if any (non-blocking)
        if (poDocuments.length > 0 && poOrder.id) {
          uploadOrderDocuments(poOrder.id, poDocuments).catch(() => {
            // Non-blocking - documents can be managed later
          })
        }

        onOrderSuccess()
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
          invoice_email: invoiceEmail,
          forklift_available: address.forkliftAvailable === "yes",
          first_order_choice: firstOrderChoice,
          first_order_truck_wash: selectedTruckWash,
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            packaging_size: item.packaging_size,
            packaging_size_id: item.packaging_size_id,
            unit_price: resolveItemUnitPrice(item),
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
        onOrderSuccess()
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
                      <Label htmlFor="forklift">
                        Forklift on site{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={address.forkliftAvailable}
                        onValueChange={(v) =>
                          updateAddress(
                            "forkliftAvailable",
                            v as "yes" | "no",
                          )
                        }
                      >
                        <SelectTrigger id="forklift" className="h-10 w-full">
                          <SelectValue placeholder="Select forklift availability" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">
                            Forklift available on site
                          </SelectItem>
                          <SelectItem value="no">
                            No forklift on site (tailgate truck required)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Selecting &quot;No forklift&quot; requires a tailgate
                        truck which costs more to ship.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Delivery Notes</Label>
                      <textarea
                        id="notes"
                        rows={3}
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder="Call on arrival, gate code, special instructions, etc."
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
                            onChange={(e) => setCardComplete(e.complete)}
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
                      <>
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

                      {/* Invoice email - editable at checkout */}
                      <div className="space-y-2">
                        <Label htmlFor="invoice-email">
                          Send invoice to{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="invoice-email"
                          type="email"
                          placeholder="accounts@company.com"
                          className="h-10"
                          value={invoiceEmail}
                          onChange={(e) => setInvoiceEmail(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Your invoice will be sent here. Defaults to the email
                          on your account.
                        </p>
                      </div>

                      {/* PO Document attachments - now mandatory */}
                      <div className="space-y-2">
                        <Label>
                          Attach Purchase Order{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Upload your signed PO document. PDF, Word, Excel, or
                          images accepted. This will be attached to the Xero
                          invoice.
                        </p>

                        {poDocuments.length > 0 && (
                          <div className="space-y-2">
                            {poDocuments.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                              >
                                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {(file.size / 1024).toFixed(0)} KB
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() =>
                                    setPoDocuments(poDocuments.filter((_, i) => i !== idx))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const input = document.createElement("input")
                            input.type = "file"
                            input.multiple = true
                            input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files
                              if (files) {
                                setPoDocuments((prev) => [...prev, ...Array.from(files)])
                              }
                            }
                            input.click()
                          }}
                        >
                          <Paperclip className="mr-2 h-4 w-4" />
                          {poDocuments.length > 0 ? "Add More Files" : "Attach Files"}
                        </Button>
                      </div>
                      </>
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
                          {poDocuments.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip className="h-3 w-3" />
                              {poDocuments.length} file{poDocuments.length > 1 ? "s" : ""} attached
                            </span>
                          )}
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
                    {cartItems.map((item) => {
                      const unitPrice = resolveItemUnitPrice(item)
                      return (
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
                              {formatCurrency(unitPrice)}
                            </p>
                          </div>
                          <span className="font-medium">
                            {formatCurrency(unitPrice * item.quantity)}
                          </span>
                        </div>
                      )
                    })}
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
                      <>Place Order - {formatCurrency(totalWithFee)}</>
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
        <div className="space-y-4">
          {isFirstOrder && (
            <FirstOrderOffer
              selectedOption={firstOrderChoice}
              onSelectOption={onFirstOrderChoiceChange}
              selectedTruckWash={selectedTruckWash}
              onSelectTruckWash={onSelectedTruckWashChange}
            />
          )}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Line Items */}
              <div className="space-y-3">
                {cartItems.map((item) => {
                  const unitPrice = resolveItemUnitPrice(item)
                  return (
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
                        {formatCurrency(unitPrice * item.quantity)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {bundleDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-primary">Bundle Discount</span>
                    <span className="font-medium text-primary">-{formatCurrency(bundleDiscount)}</span>
                  </div>
                )}
                {firstOrderDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-primary">First Order - 50% Off Truck Wash</span>
                    <span className="font-medium text-primary">-{formatCurrency(firstOrderDiscount)}</span>
                  </div>
                )}
                {/* Promotion Discounts */}
                {qualifiedPromos.filter(p => p.discountAmount > 0).map(p => (
                  <div key={p.promotionId} className="flex justify-between text-sm">
                    <span className="text-violet-400 truncate max-w-48">{p.label}</span>
                    <span className="font-medium text-violet-400">-{formatCurrency(p.discountAmount)}</span>
                  </div>
                ))}
                {qualifiedPromos.filter(p => p.bonusCreditPercent > 0).map(p => (
                  <div key={p.promotionId} className="flex justify-between text-sm">
                    <span className="text-amber-400 truncate max-w-48">{p.label}</span>
                    <span className="text-xs text-amber-400">+{p.bonusCreditPercent}% credit</span>
                  </div>
                ))}
                {/* Container Costs */}
                {containerLines.length > 0 && (
                  <div className="space-y-1.5">
                    {containerLines.map((line) => (
                      <div
                        key={line.packagingSizeId}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {line.packagingName} Container
                          {line.quantity > 1 ? ` x ${line.quantity}` : ""}
                        </span>
                        <span>{formatCurrency(line.lineCost)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-xs italic text-muted-foreground">
                    Calculated after order
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span>{formatCurrency(gst)}</span>
                </div>
                {processingFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Card Processing Fee</span>
                    <span>{formatCurrency(processingFee)}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totalWithFee)}</span>
                </div>
                {processingFee > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Includes card processing fee of {formatCurrency(processingFee)}
                  </p>
                )}
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
  const { data: bundles } = useBundles()
  const { data: orders } = useOrders()
  const { data: rewards } = useRewards()
  const { data: warehouses = [] } = useWarehouses()
  const { data: containerCosts = [] } = useContainerCosts()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [deliveryState, setDeliveryState] = useState<string>("")

  const items = cartItems ?? []

  // Pick the warehouse the order will likely ship from. Mirrors the
  // server-side logic in /api/orders so the customer sees the correct
  // container costs in the sidebar before placing the order.
  const previewWarehouse = useMemo(() => {
    const active = warehouses.filter((w) => w.is_active)
    if (active.length === 0) return null
    return (
      active.find((w) => w.address_state === deliveryState) ?? active[0]
    )
  }, [warehouses, deliveryState])

  // Build container line items from cart + container_costs for the
  // preview warehouse. Spec: "Customer sees: 'IBC Container - $200.00' as a
  // separate line in their order summary".
  const containerLines = useMemo(() => {
    if (!previewWarehouse) return []
    const lines: Array<{
      packagingSizeId: string
      packagingName: string
      unitCost: number
      quantity: number
      lineCost: number
    }> = []
    for (const item of items) {
      if (!item.packaging_size_id) continue
      const cc = containerCosts.find(
        (c) =>
          c.warehouse_id === previewWarehouse.id &&
          c.packaging_size_id === item.packaging_size_id,
      )
      const unitCost = Number(cc?.cost ?? 0)
      if (unitCost <= 0) continue
      lines.push({
        packagingSizeId: item.packaging_size_id,
        packagingName: item.packaging_size,
        unitCost,
        quantity: item.quantity,
        lineCost: Math.round(unitCost * item.quantity * 100) / 100,
      })
    }
    return lines
  }, [items, containerCosts, previewWarehouse])

  const containerTotal = useMemo(
    () =>
      Math.round(
        containerLines.reduce((sum, l) => sum + l.lineCost, 0) * 100,
      ) / 100,
    [containerLines],
  )

  // Resolve unit prices for all items using new packaging-prices model
  const itemsWithPricing = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        resolvedUnitPrice: resolveItemUnitPrice(item),
      })),
    [items],
  )

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
        itemsWithPricing.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.resolvedUnitPrice,
        }))
      ),
    [discountMap, itemsWithPricing]
  )

  // First-order choice
  const isFirstOrder = !orders?.length && !rewards?.first_order_incentive_used
  const { option: firstOrderChoice, truckWash: selectedTruckWash, setOption: setFirstOrderChoice, setTruckWash: setSelectedTruckWash, clear: clearFirstOrderChoice } = useFirstOrderChoice()

  const truckWashDiscount = useMemo(() => {
    if (!isFirstOrder || firstOrderChoice !== "half_price_truck_wash" || !selectedTruckWash) return 0
    const twItem = itemsWithPricing.find((i) => i.product.slug === selectedTruckWash)
    if (!twItem) return 0
    return Math.round(twItem.resolvedUnitPrice * twItem.quantity * 0.5 * 100) / 100
  }, [isFirstOrder, firstOrderChoice, selectedTruckWash, itemsWithPricing])

  const subtotal = itemsWithPricing.reduce(
    (sum, item) => sum + item.resolvedUnitPrice * item.quantity,
    0,
  )

  // Shipping is calculated server-side via MacShip in a future phase.
  // For now we keep it as 0 at the cart level - the order API will calculate
  // and the customer sees a placeholder until MacShip is wired up.
  const shipping = 0
  const rawShipping = 0

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

  const freeFreight = (isFirstOrder && firstOrderChoice === "free_freight") || promoFreeFreight
  const totalDiscount = bundleDiscount + truckWashDiscount + promoDiscount
  const gst = Math.round(
    (subtotal - totalDiscount + containerTotal + shipping) * 0.1 * 100,
  ) / 100
  const total = subtotal - totalDiscount + containerTotal + shipping + gst

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
              amount: Math.max(50, Math.round((total * 1.02) * 100)),
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
            containerTotal={containerTotal}
            containerLines={containerLines}
            bundleDiscount={bundleDiscount}
            firstOrderDiscount={truckWashDiscount}
            freeFreight={freeFreight}
            rawShipping={rawShipping}
            promoDiscount={promoDiscount}
            qualifiedPromos={qualifiedPromos}
            isFirstOrder={isFirstOrder}
            firstOrderChoice={firstOrderChoice}
            onFirstOrderChoiceChange={setFirstOrderChoice}
            selectedTruckWash={selectedTruckWash}
            onSelectedTruckWashChange={setSelectedTruckWash}
            onOrderSuccess={clearFirstOrderChoice}
            qualifiedBundles={qualifiedBundles}
            clientSecret={clientSecret}
            orderId={orderId}
            onOrderCreated={handleOrderCreated}
            onDeliveryStateChange={setDeliveryState}
          />
        </Elements>
      </m.div>
    </LazyMotion>
  )
}
