import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { getStripeServer } from "@/lib/stripe"
import {
  sendOrderConfirmationEmail,
  notifyAdminNewOrder,
} from "@/lib/email/notifications"

const GST_RATE = 0.1
const SHIPPING_COST = 0

// GET /api/orders - list orders (user sees own, admin sees all)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = request.nextUrl
    const statusFilter = searchParams.get("status")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isAdmin = profile?.role === "admin"

    const orderItemsSelect = `
      id,
      product_id,
      product_name,
      product_image_url,
      quantity,
      unit,
      packaging_size,
      unit_price,
      total_price
    `

    let query = supabase
      .from("orders")
      .select(`*, order_items (${orderItemsSelect})`)

    if (!isAdmin) {
      query = query.eq("user_id", user.id)
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter)
    }

    query = query.order("created_at", { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For admin, fetch profiles for all unique user_ids
    let profileMap = new Map<string, { email: string; company_name: string | null; contact_name: string | null; phone: string | null }>()

    if (isAdmin && data && data.length > 0) {
      const userIds = [...new Set(data.map((o) => o.user_id))]
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, company_name, contact_name, phone")
        .in("id", userIds)

      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, { email: p.email, company_name: p.company_name, contact_name: p.contact_name, phone: p.phone })
        }
      }
    }

    // Transform response to match Order type
    const orders = (data ?? []).map((order) => {
      const { order_items, ...rest } = order
      return {
        ...rest,
        items: order_items ?? [],
        profile: profileMap.get(order.user_id) ?? undefined,
      }
    })

    return NextResponse.json(orders)
  } catch (err) {
    console.error("GET /api/orders error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// POST /api/orders - create a new order
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const body = await request.json()
    const {
      payment_method,
      po_number,
      items,
      delivery_address_street,
      delivery_address_city,
      delivery_address_state,
      delivery_address_postcode,
      delivery_notes,
    } = body

    if (!payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "payment_method and items are required" },
        { status: 400 },
      )
    }

    if (!["stripe", "purchase_order"].includes(payment_method)) {
      return NextResponse.json(
        { error: "payment_method must be 'stripe' or 'purchase_order'" },
        { status: 400 },
      )
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unit_price: number }) =>
        sum + item.quantity * item.unit_price,
      0,
    )
    const shipping = SHIPPING_COST
    const gst = Math.round(subtotal * GST_RATE * 100) / 100
    const total = Math.round((subtotal + shipping + gst) * 100) / 100

    let clientSecret: string | null = null
    let stripePaymentIntentId: string | null = null

    // For stripe payments, create a PaymentIntent
    if (payment_method === "stripe") {
      const paymentIntent = await getStripeServer().paymentIntents.create({
        amount: Math.round(total * 100), // Stripe expects cents
        currency: "aud",
        metadata: {
          user_id: user.id,
        },
      })
      clientSecret = paymentIntent.client_secret
      stripePaymentIntentId = paymentIntent.id
    }

    // Fetch product details for order items snapshot
    const productIds = items.map((item: { product_id: string }) => item.product_id)
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, image_url, unit")
      .in("id", productIds)

    const productMap = new Map(
      (productsData ?? []).map((p: { id: string; name: string; image_url: string | null; unit: string }) => [p.id, p]),
    )

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "received",
        payment_method,
        payment_status: "pending",
        po_number: po_number || null,
        stripe_payment_intent_id: stripePaymentIntentId,
        subtotal,
        shipping,
        gst,
        total,
        delivery_address_street: delivery_address_street || null,
        delivery_address_city: delivery_address_city || null,
        delivery_address_state: delivery_address_state || null,
        delivery_address_postcode: delivery_address_postcode || null,
        delivery_notes: delivery_notes || null,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Insert order items with product snapshot data
    const orderItems = items.map(
      (item: {
        product_id: string
        quantity: number
        packaging_size: string
        unit_price: number
      }) => {
        const product = productMap.get(item.product_id)
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: product?.name ?? "Unknown Product",
          product_image_url: product?.image_url ?? null,
          unit: product?.unit ?? "L",
          quantity: item.quantity,
          packaging_size: item.packaging_size,
          unit_price: item.unit_price,
          total_price: Math.round(item.quantity * item.unit_price * 100) / 100,
        }
      },
    )

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems)

    if (itemsError) {
      // Clean up the order if items insertion fails
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Clear user's cart
    const { error: cartError } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)

    if (cartError) {
      console.error("Failed to clear cart after order creation:", cartError.message)
    }

    // Get user profile for email
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("contact_name, email, company_name")
      .eq("id", user.id)
      .single()

    const customerName = userProfile?.contact_name || "Customer"
    const customerEmail = userProfile?.email || user.email || ""

    // Send order confirmation email to customer (non-blocking)
    if (payment_method === "purchase_order") {
      sendOrderConfirmationEmail(customerEmail, {
        customerName,
        orderNumber: order.order_number,
        items: orderItems.map((item) => ({
          name: item.product_name,
          qty: item.quantity,
          unitPrice: item.unit_price,
          total: item.total_price,
        })),
        subtotal,
        shipping,
        gst,
        total,
        paymentMethod: "Purchase Order",
        poNumber: po_number,
      })
    }

    // Notify admin of new order (non-blocking)
    notifyAdminNewOrder({
      customerName,
      customerEmail,
      companyName: userProfile?.company_name ?? undefined,
      orderNumber: order.order_number,
      total,
      paymentMethod: payment_method === "stripe" ? "Card Payment" : "Purchase Order",
      itemCount: orderItems.length,
    })

    return NextResponse.json(
      {
        ...order,
        client_secret: clientSecret,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error("POST /api/orders error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
