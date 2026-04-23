"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
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
  Mail,
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
  useFinalizeOrder,
  type Order,
  type StripeCheckoutSession,
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
  if (!prices || prices.length === 0) {
    // No packaging_prices configured - use base product price.
    // For per-litre products, multiply by volume extracted from the size name.
    return fallbackPrice(item)
  }
  const match =
    prices.find((p) => p.packaging_size_id === item.packaging_size_id) ??
    prices.find((p) => p.packaging_size?.name === item.packaging_size)
  if (!match) {
    // No matching packaging_prices entry for this specific size.
    // Fall back to base price × volume for per-litre products.
    return fallbackPrice(item)
  }
  return calculateUnitPrice(
    item.product.price_type,
    match,
    match.packaging_size,
  )
}

/** Fallback price when no product_packaging_prices entry exists.
 *  For per-litre products, multiplies the base price by the volume
 *  extracted from the packaging size name (e.g. "200L Drum" → 200). */
function fallbackPrice(item: CartItem): number {
  const basePrice = Number(item.product.price) || 0
  if (item.product.price_type === "per_litre") {
    // Try to get volume from the packaging_size name
    const volumeMatch = item.packaging_size.match(/(\d+)\s*[Ll]/)
    if (volumeMatch) {
      const litres = parseInt(volumeMatch[1], 10)
      return Math.round(basePrice * litres * 100) / 100
    }
  }
  return basePrice
}

function resolveItemMoq(item: CartItem): number {
  const prices = item.product.packaging_prices
  if (!prices || prices.length === 0) return 1
  const match =
    prices.find((p) => p.packaging_size_id === item.packaging_size_id) ??
    prices.find((p) => p.packaging_size?.name === item.packaging_size)
  return match?.minimum_order_quantity ?? 1
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

interface MacshipQuoteResult {
  serviceable: boolean
  shipping_amount: number | null
  carrier_name: string | null
  carrier_id: string | null
  service_name?: string | null
  warehouse_id: string | null
  warehouse_name: string | null
  pickup_date: string | null
  is_partial_fulfillment: boolean
  missing_product_ids: string[]
  pricing?: {
    base_rate: number
    fuel_levy: number
    fuel_levy_percent: number
    tax: number
    tax_percent: number
    before_tax: number
    tailgate_applied: boolean
    tailgate_amount: number
    tailgate_name: string | null
    other_surcharges: Array<{ name: string; amount: number }>
    total: number
  } | null
  eta_date?: string | null
  eta_business_days?: number | null
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
  freeFreightSavings: number
  freeFreightCap: number
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
  checkoutSessionId: string | null
  paymentIntentId: string | null
  onOrderCreated: (result: Order | StripeCheckoutSession) => void
  onDeliveryStateChange: (state: string) => void
  macshipQuote: MacshipQuoteResult | null
  quoteLoading: boolean
  onDeliveryPostcodeChange: (postcode: string) => void
  onDeliveryCityChange: (city: string) => void
  onDeliveryForkliftChange: (hasForklift: boolean) => void
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
  freeFreightSavings,
  freeFreightCap: FREE_FREIGHT_CAP,
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
  checkoutSessionId,
  paymentIntentId,
  onOrderCreated,
  onDeliveryStateChange,
  macshipQuote,
  quoteLoading,
  onDeliveryPostcodeChange,
  onDeliveryCityChange,
  onDeliveryForkliftChange,
}: CheckoutFormProps) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const createOrder = useCreateOrder()
  const finalizeOrder = useFinalizeOrder()

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

  // Bubble up postcode and city when pre-filled from profile
  useEffect(() => {
    if (address.postcode) {
      onDeliveryPostcodeChange(address.postcode)
    }
  }, [address.postcode, onDeliveryPostcodeChange])

  useEffect(() => {
    if (address.city) {
      onDeliveryCityChange(address.city)
    }
  }, [address.city, onDeliveryCityChange])

  // ------- Validation -------
  const isDeliveryValid = useMemo(
    () =>
      address.street.trim() !== "" &&
      address.city.trim() !== "" &&
      address.state !== "" &&
      address.postcode.trim() !== "" &&
      address.forkliftAvailable !== "" &&
      macshipQuote?.serviceable !== false &&
      !quoteLoading,
    [address, macshipQuote, quoteLoading]
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

  const moqViolations = useMemo(
    () => cartItems.filter((item) => item.quantity < resolveItemMoq(item)),
    [cartItems],
  )
  const hasMoqViolation = moqViolations.length > 0

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
          macship_carrier_id: macshipQuote?.carrier_id,
          macship_quote_amount: macshipQuote?.shipping_amount,
          macship_shipping_breakdown: macshipQuote?.pricing ?? null,
          macship_service_name: macshipQuote?.service_name ?? null,
          macship_eta_date: macshipQuote?.eta_date ?? null,
          macship_eta_business_days: macshipQuote?.eta_business_days ?? null,
        })

        // PO path always returns a full Order row; narrow the union.
        if ("checkout_session_id" in poOrder) {
          toast.error("Unexpected response shape for PO order.")
          setIsSubmitting(false)
          return
        }

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

      // Stripe flow:
      //   1. create checkout_session + PaymentIntent  (no order row yet)
      //   2. stripe.confirmPayment                     (charges the card)
      //   3. POST /api/orders/finalize                 (inserts order + side effects)
      // If the card is declined at step 2, no order or MacShip/Xero
      // side effects were fired - the session just sits until it expires.
      if (!stripe || !elements) {
        toast.error("Payment not ready. Please try again.")
        setIsSubmitting(false)
        return
      }

      const { error: submitError } = await elements.submit()
      if (submitError) {
        toast.error("Please check your card details and try again.")
        setIsSubmitting(false)
        return
      }

      // Reuse an existing session on retry (e.g. after a card decline) so
      // we don't pile up orphan PaymentIntents on the Stripe account.
      let session:
        | { checkout_session_id: string; payment_intent_id: string; client_secret: string }
        | null =
        checkoutSessionId && paymentIntentId && clientSecret
          ? {
              checkout_session_id: checkoutSessionId,
              payment_intent_id: paymentIntentId,
              client_secret: clientSecret,
            }
          : null

      if (!session) {
        const created = await createOrder.mutateAsync({
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
          macship_carrier_id: macshipQuote?.carrier_id,
          macship_quote_amount: macshipQuote?.shipping_amount,
          macship_shipping_breakdown: macshipQuote?.pricing ?? null,
          macship_service_name: macshipQuote?.service_name ?? null,
          macship_eta_date: macshipQuote?.eta_date ?? null,
          macship_eta_business_days: macshipQuote?.eta_business_days ?? null,
        })

        // The Stripe path returns a StripeCheckoutSession, not a full Order.
        if (!("checkout_session_id" in created) || !created.client_secret) {
          toast.error("Failed to initialize payment. Please try again.")
          setIsSubmitting(false)
          return
        }

        session = {
          checkout_session_id: created.checkout_session_id,
          payment_intent_id: created.payment_intent_id,
          client_secret: created.client_secret,
        }
        onOrderCreated(created)
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret: session.client_secret,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/orders`,
        },
        redirect: "if_required",
      })

      const error = result.error
      const paymentIntent = "paymentIntent" in result ? result.paymentIntent : undefined

      if (error) {
        toast.error(
          "Payment could not be processed. Please check your card details or try a different payment method.",
        )
        setIsSubmitting(false)
        return
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Finalize: inserts the real order from the saved session and
        // fires MacShip/Xero/emails. Idempotent with the webhook safety net.
        await finalizeOrder.mutateAsync({
          payment_intent_id: paymentIntent.id,
          checkout_session_id: session.checkout_session_id,
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
    poDocuments,
    invoiceEmail,
    firstOrderChoice,
    selectedTruckWash,
    cartItems,
    macshipQuote,
    address,
    stripe,
    elements,
    clientSecret,
    orderId,
    checkoutSessionId,
    paymentIntentId,
    createOrder,
    finalizeOrder,
    onOrderCreated,
    onOrderSuccess,
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
                          onChange={(e) => {
                            updateAddress("city", e.target.value)
                            onDeliveryCityChange(e.target.value)
                          }}
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
                          onChange={(e) => {
                            updateAddress("postcode", e.target.value)
                            onDeliveryPostcodeChange(e.target.value)
                          }}
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
                        onValueChange={(v) => {
                          updateAddress(
                            "forkliftAvailable",
                            v as "yes" | "no",
                          )
                          onDeliveryForkliftChange(v === "yes")
                        }}
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

                    {macshipQuote?.serviceable === false && (
                      <UnserviceablePostcodeBlock
                        postcode={address.postcode}
                        city={address.city}
                        state={address.state}
                      />
                    )}

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

                {/* MOQ violation banner */}
                {hasMoqViolation && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                      <div>
                        <p className="text-sm font-semibold text-destructive">
                          Minimum order quantity not met
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {moqViolations.map((item) => (
                            <li key={item.id} className="text-xs text-destructive/80">
                              <span className="font-medium">{item.product.name}</span>{" "}
                              ({item.packaging_size}) — requires at least{" "}
                              <span className="font-semibold">{resolveItemMoq(item)} units</span>,
                              you have {item.quantity}.
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-destructive/70">
                          Please go back to your cart and update the quantities.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={goBack}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || hasMoqViolation}
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
                {/* Shipping - with transparent breakdown */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  {quoteLoading ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Calculating...
                    </span>
                  ) : freeFreight && macshipQuote?.serviceable && macshipQuote.shipping_amount ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(macshipQuote.shipping_amount)}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Free
                      </span>
                    </span>
                  ) : freeFreight && shipping > 0 && macshipQuote?.serviceable ? (
                    <span className="font-medium">{formatCurrency(shipping)}</span>
                  ) : macshipQuote?.serviceable && macshipQuote.shipping_amount !== null ? (
                    <span className="font-medium">{formatCurrency(macshipQuote.shipping_amount)}</span>
                  ) : macshipQuote?.serviceable === false ? (
                    <span className="text-xs text-amber-500">Not serviceable</span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">
                      Calculated at checkout
                    </span>
                  )}
                </div>
                {/* Free freight badge */}
                {freeFreight && freeFreightSavings > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      First order bonus - free freight (up to {formatCurrency(FREE_FREIGHT_CAP)})
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      -{formatCurrency(freeFreightSavings)}
                    </span>
                  </div>
                )}
                {/* Shipping breakdown - shown when quote is loaded (even with free freight so customer sees what's waived) */}
                {macshipQuote?.serviceable && macshipQuote.pricing && (
                  <div className={`ml-3 space-y-1 border-l-2 border-border/50 pl-3 ${freeFreight ? "opacity-50" : ""}`}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Base freight</span>
                      <span>{formatCurrency(macshipQuote.pricing.base_rate)}</span>
                    </div>
                    {macshipQuote.pricing.fuel_levy > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Fuel levy ({macshipQuote.pricing.fuel_levy_percent.toFixed(1)}%)</span>
                        <span>{formatCurrency(macshipQuote.pricing.fuel_levy)}</span>
                      </div>
                    )}
                    {macshipQuote.pricing.tailgate_applied && (
                      <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                        <span>{macshipQuote.pricing.tailgate_name ?? "Tailgate surcharge"}</span>
                        <span>{formatCurrency(macshipQuote.pricing.tailgate_amount)}</span>
                      </div>
                    )}
                    {macshipQuote.pricing.other_surcharges.map((s) => (
                      <div key={s.name} className="flex justify-between text-xs text-muted-foreground">
                        <span>{s.name}</span>
                        <span>{formatCurrency(s.amount)}</span>
                      </div>
                    ))}
                    {macshipQuote.pricing.tax > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Shipping GST ({macshipQuote.pricing.tax_percent}%)</span>
                        <span>{formatCurrency(macshipQuote.pricing.tax)}</span>
                      </div>
                    )}
                  </div>
                )}
                {macshipQuote?.carrier_name && macshipQuote.serviceable && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Carrier</span>
                    <span className="text-muted-foreground">
                      {macshipQuote.carrier_name}
                      {macshipQuote.service_name ? ` - ${macshipQuote.service_name}` : ""}
                    </span>
                  </div>
                )}
                {macshipQuote?.pickup_date && macshipQuote.serviceable && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Est. dispatch</span>
                    <span className="text-muted-foreground">
                      {new Date(macshipQuote.pickup_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                )}
                {macshipQuote?.eta_date && macshipQuote.serviceable && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Est. delivery</span>
                    <span className="text-muted-foreground">
                      {new Date(macshipQuote.eta_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                      {macshipQuote.eta_business_days != null ? ` (${macshipQuote.eta_business_days}d)` : ""}
                    </span>
                  </div>
                )}
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
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [deliveryState, setDeliveryState] = useState<string>("")
  const [macshipQuote, setMacshipQuote] = useState<MacshipQuoteResult | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [deliveryPostcode, setDeliveryPostcode] = useState("")
  const [deliveryCity, setDeliveryCity] = useState("")
  const [deliveryForklift, setDeliveryForklift] = useState<boolean | null>(null)

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

  // Shipping comes from the live Machship quote. We treat the quote as
  // authoritative - if it's still loading or the postcode isn't serviceable,
  // shipping is 0 and the "Continue to Payment" button is already gated
  // elsewhere so the customer can't complete checkout without a valid quote.
  const rawShipping =
    macshipQuote?.serviceable && macshipQuote.shipping_amount !== null
      ? Number(macshipQuote.shipping_amount)
      : 0

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
  const rawPromoDiscount = useMemo(() => calculatePromotionDiscount(qualifiedPromos), [qualifiedPromos])
  // Option A (confirmed by Jonny): only one 50% discount per item.
  // If the first-order truck wash discount is already applied to a product,
  // the promo discount on that same product is skipped. Since both are
  // typically 50% of the same truck wash item, we subtract the truck wash
  // discount amount from the promo total to avoid double-dipping.
  const promoDiscount = useMemo(() => {
    if (truckWashDiscount > 0 && rawPromoDiscount > 0) {
      // Both discounts active - cap the promo so the truck wash product
      // doesn't get discounted twice. The first-order bonus takes priority.
      return Math.max(0, rawPromoDiscount - truckWashDiscount)
    }
    return rawPromoDiscount
  }, [rawPromoDiscount, truckWashDiscount])
  const promoFreeFreight = useMemo(() => hasPromotionFreeFreight(qualifiedPromos), [qualifiedPromos])

  const freeFreight = (isFirstOrder && firstOrderChoice === "free_freight") || promoFreeFreight
  // Apply free-freight discount: waive the live quote entirely
  // Free freight is capped at $500 (confirmed by Jonny, April 2026).
  // If shipping exceeds the cap, customer pays the difference.
  const FREE_FREIGHT_CAP = 500
  const shipping = freeFreight
    ? Math.max(0, Math.round((rawShipping - FREE_FREIGHT_CAP) * 100) / 100)
    : rawShipping
  const freeFreightSavings = freeFreight
    ? Math.min(rawShipping, FREE_FREIGHT_CAP)
    : 0
  const totalDiscount = bundleDiscount + truckWashDiscount + promoDiscount
  const gst = Math.round(
    (subtotal - totalDiscount + containerTotal + shipping) * 0.1 * 100,
  ) / 100
  const total = subtotal - totalDiscount + containerTotal + shipping + gst

  const fetchMacShipQuote = useCallback(async (
    postcode: string,
    state: string,
    city: string,
    forkliftAvailable: boolean | null,
  ) => {
    if (!postcode || postcode.length < 4 || !state || !city.trim() || items.length === 0) return
    setQuoteLoading(true)
    try {
      const response = await fetch("/api/macship/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_postcode: postcode,
          delivery_state: state,
          delivery_city: city,
          cart_items: items.map((item) => ({
            product_id: item.product_id,
            packaging_size_id: item.packaging_size_id,
            packaging_size_name: item.packaging_size,
            quantity: item.quantity,
          })),
          // Pass the actual forklift selection so Machship applies
          // the tailgate surcharge (questionId 7) when no forklift.
          forklift_available: forkliftAvailable ?? true,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setMacshipQuote(data)
      }
    } catch {
      // Non-blocking - quote failure doesn't block checkout
    } finally {
      setQuoteLoading(false)
    }
  }, [items])

  useEffect(() => {
    if (deliveryPostcode.length >= 4 && deliveryState && deliveryCity.trim()) {
      const timer = setTimeout(() => {
        fetchMacShipQuote(deliveryPostcode, deliveryState, deliveryCity, deliveryForklift)
      }, 600) // debounce 600ms
      return () => clearTimeout(timer)
    }
  }, [deliveryPostcode, deliveryState, deliveryCity, deliveryForklift, fetchMacShipQuote])

  const handleDeliveryStateChange = useCallback((state: string) => {
    setDeliveryState(state)
    setMacshipQuote(null)
  }, [])

  // PO orders return a full Order row; card orders return a
  // StripeCheckoutSession (no order exists yet - it's created by
  // finalize after the PaymentIntent succeeds).
  const handleOrderCreated = useCallback(
    (result: Order | StripeCheckoutSession) => {
      if ("checkout_session_id" in result) {
        setCheckoutSessionId(result.checkout_session_id)
        setPaymentIntentId(result.payment_intent_id)
        setClientSecret(result.client_secret)
      } else {
        setOrderId(result.id)
      }
    },
    [],
  )

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
            freeFreightSavings={freeFreightSavings}
            freeFreightCap={FREE_FREIGHT_CAP}
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
            checkoutSessionId={checkoutSessionId}
            paymentIntentId={paymentIntentId}
            onOrderCreated={handleOrderCreated}
            onDeliveryStateChange={handleDeliveryStateChange}
            macshipQuote={macshipQuote}
            quoteLoading={quoteLoading}
            onDeliveryPostcodeChange={setDeliveryPostcode}
            onDeliveryCityChange={setDeliveryCity}
            onDeliveryForkliftChange={(v) => setDeliveryForklift(v)}
          />
        </Elements>
      </m.div>
    </LazyMotion>
  )
}

// ============================================================
// Unserviceable postcode CTA - sends enquiry to admin
// ============================================================

function UnserviceablePostcodeBlock({
  postcode,
  city,
  state,
}: {
  postcode: string
  city: string
  state: string
}) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleRequestQuote() {
    setSending(true)
    try {
      const res = await fetch("/api/shipping-enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postcode,
          city,
          state,
          cart_summary: "Submitted from checkout - unserviceable postcode",
        }),
      })
      if (res.ok) {
        setSent(true)
        toast.success(
          "Request sent! Our team will contact you within 1 business day.",
        )
      } else {
        toast.error("Could not send request - please call us instead")
      }
    } catch {
      toast.error("Could not send request - please call us instead")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
        We can&apos;t calculate shipping for postcode {postcode}.
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        This area isn&apos;t covered by our standard carriers yet. Request a
        custom quote and our team will get back to you within 1 business day
        with a shipping option for your site.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {sent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            Quote requested - we&apos;ll be in touch
          </span>
        ) : (
          <Button
            size="sm"
            variant="default"
            className="h-9 rounded-lg text-xs font-semibold"
            onClick={handleRequestQuote}
            disabled={sending}
          >
            {sending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="mr-1.5 size-3.5" />
                Request Custom Quote
              </>
            )}
          </Button>
        )}

      </div>
    </div>
  )
}
