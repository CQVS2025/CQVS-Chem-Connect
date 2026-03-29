import { sendEmail } from "./send"
import { buildReceiptHtml } from "./receipt"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

interface ReceiptEmailData {
  customerName: string
  companyName?: string
  customerEmail: string
  orderNumber: string
  date: string
  items: {
    name: string
    qty: number
    unit: string
    packagingSize: string
    unitPrice: number
    total: number
  }[]
  subtotal: number
  shipping: number
  gst: number
  processingFee?: number
  total: number
  paymentMethod: string
  poNumber?: string
  stripeReceiptUrl?: string
  deliveryAddress?: string
}

/**
 * Send a branded receipt/invoice email with the full order breakdown.
 * Includes Stripe receipt link if available.
 */
export async function sendReceiptEmail(
  customerEmail: string,
  data: ReceiptEmailData,
): Promise<void> {
  try {
    const receiptHtml = buildReceiptHtml({
      orderNumber: data.orderNumber,
      date: data.date,
      customerName: data.customerName,
      companyName: data.companyName,
      customerEmail: data.customerEmail,
      items: data.items,
      subtotal: data.subtotal,
      shipping: data.shipping,
      gst: data.gst,
      processingFee: data.processingFee,
      total: data.total,
      paymentMethod: data.paymentMethod,
      poNumber: data.poNumber,
      stripeReceiptUrl: data.stripeReceiptUrl,
      deliveryAddress: data.deliveryAddress,
    })

    const isPO = data.paymentMethod === "Purchase Order"

    await sendEmail({
      to: customerEmail,
      subject: isPO
        ? `Purchase Order Confirmation - ${data.orderNumber} - Chem Connect`
        : `Payment Receipt - ${data.orderNumber} - Chem Connect`,
      heading: isPO ? "Purchase Order Submitted" : "Your Payment Receipt",
      preheader: isPO
        ? `Your PO order ${data.orderNumber} has been submitted for review.`
        : `Receipt for order ${data.orderNumber} - $${data.total.toFixed(2)}`,
      sections: [
        {
          content: isPO
            ? `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
              <p style="margin: 0 0 8px 0;">Your purchase order <strong style="color: #4ADE80;">${data.orderNumber}</strong> has been submitted successfully with PO reference <strong>${data.poNumber || "N/A"}</strong>.</p>
              <p style="margin: 0 0 8px 0;">Our team will review your order and be in touch shortly to confirm details and arrange invoicing through your company's purchasing process.</p>
              <p style="margin: 0 0 0 0; color: #94A3B8; font-size: 13px;">No payment is required at this stage. A formal invoice will be sent separately by our accounts team once the order is confirmed.</p>`
            : `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
              <p style="margin: 0 0 8px 0;">Thank you for your payment. Your receipt for order <strong style="color: #4ADE80;">${data.orderNumber}</strong> is below.</p>`,
        },
        {
          title: isPO ? "Order Summary" : "Receipt",
          content: receiptHtml,
        },
      ],
      ctaButton: {
        text: "View Order Details",
        url: `${APP_URL}/dashboard/orders`,
      },
      footerNote: isPO
        ? "A member of our team will contact you to confirm your order and arrange payment. If you have any questions, please contact support@chemconnect.com.au."
        : data.stripeReceiptUrl
          ? `You can also view your Stripe payment receipt at: ${data.stripeReceiptUrl}`
        : undefined,
    })
  } catch (error) {
    console.error("Failed to send receipt email:", error)
  }
}
