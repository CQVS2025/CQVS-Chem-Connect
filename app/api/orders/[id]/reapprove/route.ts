import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send"
import { sendReceiptEmail } from "@/lib/email/receipt-email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin()
  if (error) return error

  const supabase = createServiceRoleClient()
  const { id } = await params

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()

  if (orderError || !order) {
    console.error("[reapprove] Order fetch failed:", orderError?.message)
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  if (order.status !== "rejected") {
    return NextResponse.json(
      { error: "Order status must be rejected to re-approve" },
      { status: 400 },
    )
  }

  // Update order status to "received"
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "received" })
    .eq("id", id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Insert status history entry
  await supabase.from("order_status_history").insert({
    order_id: id,
    status: "received",
    note: "Purchase order re-approved by admin",
  })

  // Create Xero invoice and PO if not already created
  try {
    const { createXeroInvoiceForOrder, createXeroPurchaseOrderForOrder } =
      await import("@/lib/xero/sync")

    if (!order.xero_invoice_id) {
      const invoiceResult = await createXeroInvoiceForOrder(id)
      if (invoiceResult) {
        console.log(`[Xero] Invoice created for re-approved order ${order.order_number}: ${invoiceResult.invoiceNumber}`)
      } else {
        console.warn(`[Xero] Invoice NOT created for re-approved order ${order.order_number}`)
      }
    }

    if (!order.xero_po_id) {
      const poResult = await createXeroPurchaseOrderForOrder(id)
      if (poResult) {
        console.log(`[Xero] PO created for re-approved order ${order.order_number}: ${poResult.poNumber}`)
      } else {
        console.warn(`[Xero] PO NOT created for re-approved order ${order.order_number}`)
      }
    }
  } catch (xeroErr) {
    console.error("[Xero] Failed during re-approval Xero sync:", xeroErr)
  }

  // Fetch items and profile separately
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id)

  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_name, email, company_name")
    .eq("id", order.user_id)
    .single()

  const customerEmail = profile?.email || ""
  const customerName = profile?.contact_name || "Customer"

  if (customerEmail) {
    sendEmail({
      to: customerEmail,
      subject: `Order #${order.order_number} Approved`,
      heading: "Your Purchase Order Has Been Approved!",
      preheader: `Great news! Order #${order.order_number} has been approved.`,
      sections: [
        {
          content: `
            <p>Hi ${customerName},</p>
            <p>Your purchase order has been approved! You'll receive an invoice shortly.</p>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p>Your order will now be processed for delivery. We'll keep you updated on its progress.</p>
          `,
        },
      ],
    }).catch(() => {})

    const effectiveShipping = order.shipping ?? 0
    sendReceiptEmail(customerEmail, {
      customerName,
      companyName: profile?.company_name || undefined,
      customerEmail,
      orderNumber: order.order_number,
      date: new Date().toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      items: (orderItems ?? []).map((item: {
        product_name: string
        quantity: number
        unit: string
        packaging_size: string
        unit_price: number
        total_price: number
        shipping_fee?: number
      }) => ({
        name: item.product_name,
        qty: item.quantity,
        unit: item.unit,
        packagingSize: item.packaging_size,
        unitPrice: item.unit_price,
        total: item.total_price,
        shippingFee: effectiveShipping === 0 ? 0 : (item.shipping_fee ?? 0),
      })),
      subtotal: order.subtotal,
      shipping: effectiveShipping,
      gst: order.gst,
      processingFee: order.processing_fee,
      total: order.total,
      paymentMethod: "Purchase Order",
      poNumber: order.po_number || undefined,
      deliveryAddress: [
        order.delivery_address_street,
        order.delivery_address_city,
        order.delivery_address_state,
        order.delivery_address_postcode,
      ].filter(Boolean).join(", ") || undefined,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
