import { sendEmail, isEmailEnabled, getAdminEmail } from "./send"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

// Status color maps for emails (inline styles)
const orderStatusColors: Record<string, { bg: string; text: string }> = {
  received: { bg: "#3B82F6", text: "#FFFFFF" },
  processing: { bg: "#F59E0B", text: "#1C1917" },
  in_transit: { bg: "#8B5CF6", text: "#FFFFFF" },
  delivered: { bg: "#10B981", text: "#FFFFFF" },
  cancelled: { bg: "#EF4444", text: "#FFFFFF" },
}

const quoteStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#F59E0B", text: "#1C1917" },
  reviewed: { bg: "#3B82F6", text: "#FFFFFF" },
  responded: { bg: "#10B981", text: "#FFFFFF" },
  closed: { bg: "#71717A", text: "#FFFFFF" },
}

function statusBadge(
  label: string,
  colors: { bg: string; text: string },
): string {
  return `<span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; font-family: Arial, Helvetica, sans-serif; background-color: ${colors.bg}; color: ${colors.text};">${label}</span>`
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Quote notifications
// ---------------------------------------------------------------------------

export async function sendQuoteReceivedEmail(
  customerEmail: string,
  data: {
    customerName: string
    productName: string
    quantity: number
    packagingSize?: string
  },
) {
  try {
    const packagingLine = data.packagingSize
      ? `<tr>
          <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Packaging Size</td>
          <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.packagingSize}</td>
        </tr>`
      : ""

    await sendEmail({
      to: customerEmail,
      subject: "Quote Request Received - Chem Connect",
      heading: "We received your quote request",
      preheader: `Your quote for ${data.productName} has been received.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
            <p style="margin: 0 0 8px 0;">Thank you for your interest. We have received your quote request and our team will review it shortly.</p>`,
        },
        {
          title: "Request Details",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Product</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.productName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Quantity</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.quantity}</td>
            </tr>
            ${packagingLine}
          </table>`,
        },
      ],
      ctaButton: {
        text: "View My Quotes",
        url: `${APP_URL}/dashboard/quotes`,
      },
      footerNote:
        "We typically respond within 1-2 business days. If you have urgent requirements, please contact our support team directly.",
    })
  } catch (error) {
    console.error("Failed to send quote received email:", error)
  }
}

export async function sendQuoteStatusUpdateEmail(
  customerEmail: string,
  data: {
    customerName: string
    productName: string
    status: string
    adminNotes?: string
  },
) {
  try {
    const statusLabel = formatStatus(data.status)
    const colors = quoteStatusColors[data.status] || { bg: "#4ADE80", text: "#1C1917" }
    const notesSection = data.adminNotes
      ? [
          {
            title: "Notes from Our Team",
            content: `<p style="margin: 0; font-style: italic;">${data.adminNotes}</p>`,
          },
        ]
      : []

    await sendEmail({
      to: customerEmail,
      subject: `Quote Update: ${statusLabel} - Chem Connect`,
      heading: "Your quote has been updated",
      preheader: `Your quote for ${data.productName} is now ${statusLabel}.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
            <p style="margin: 0 0 8px 0;">Your quote request for <strong style="color: #4ADE80;">${data.productName}</strong> has been updated.</p>`,
        },
        {
          title: "Status Update",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Product</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.productName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Status</td>
              <td style="padding: 8px 12px;">${statusBadge(statusLabel, colors)}</td>
            </tr>
          </table>`,
        },
        ...notesSection,
      ],
      ctaButton: {
        text: "View My Quotes",
        url: `${APP_URL}/dashboard/quotes`,
      },
    })
  } catch (error) {
    console.error("Failed to send quote status update email:", error)
  }
}

export async function notifyAdminNewQuote(data: {
  customerName: string
  customerEmail: string
  customerPhone?: string
  companyName?: string
  productName: string
  quantity: number
  packagingSize?: string
  deliveryLocation?: string
  message?: string
}) {
  try {
    const enabled = await isEmailEnabled()
    if (!enabled) return

    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      console.error("No admin support email configured - skipping admin notification")
      return
    }

    const optionalRows = [
      data.customerPhone
        ? `<tr style="border-bottom: 1px solid #1E3A4C;">
            <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Phone</td>
            <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.customerPhone}</td>
          </tr>`
        : "",
      data.companyName
        ? `<tr style="border-bottom: 1px solid #1E3A4C;">
            <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Company</td>
            <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.companyName}</td>
          </tr>`
        : "",
      data.packagingSize
        ? `<tr style="border-bottom: 1px solid #1E3A4C;">
            <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Packaging</td>
            <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.packagingSize}</td>
          </tr>`
        : "",
      data.deliveryLocation
        ? `<tr style="border-bottom: 1px solid #1E3A4C;">
            <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Delivery Location</td>
            <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.deliveryLocation}</td>
          </tr>`
        : "",
    ]
      .filter(Boolean)
      .join("\n")

    const messageSection = data.message
      ? [
          {
            title: "Customer Message",
            content: `<p style="margin: 0;">${data.message}</p>`,
          },
        ]
      : []

    await sendEmail({
      to: adminEmail,
      subject: `New Quote Request from ${data.customerName}`,
      heading: "New Quote Request",
      preheader: `${data.customerName} requested a quote for ${data.productName}.`,
      sections: [
        {
          title: "Customer Details",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Name</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.customerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Email</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.customerEmail}</td>
            </tr>
            ${optionalRows}
          </table>`,
        },
        {
          title: "Product Request",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Product</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.productName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Quantity</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.quantity}</td>
            </tr>
          </table>`,
        },
        ...messageSection,
      ],
      ctaButton: {
        text: "Review in Admin Panel",
        url: `${APP_URL}/admin/quotes`,
      },
    })
  } catch (error) {
    console.error("Failed to send admin new quote notification:", error)
  }
}

// ---------------------------------------------------------------------------
// Order notifications
// ---------------------------------------------------------------------------

export async function sendOrderConfirmationEmail(
  customerEmail: string,
  data: {
    customerName: string
    orderNumber: string
    items: { name: string; qty: number; unitPrice: number; total: number }[]
    subtotal: number
    shipping: number
    gst: number
    total: number
    paymentMethod: string
    poNumber?: string
  },
) {
  try {
    const itemRows = data.items
      .map(
        (item) =>
          `<tr style="border-bottom: 1px solid #1E3A4C;">
            <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${item.name}</td>
            <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: center;">${item.qty}</td>
            <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right;">${formatCurrency(item.unitPrice)}</td>
            <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right;">${formatCurrency(item.total)}</td>
          </tr>`,
      )
      .join("\n")

    const poLine = data.poNumber
      ? `<tr style="border-bottom: 1px solid #1E3A4C;">
          <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">PO Number</td>
          <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.poNumber}</td>
        </tr>`
      : ""

    await sendEmail({
      to: customerEmail,
      subject: `Order Confirmed - ${data.orderNumber} - Chem Connect`,
      heading: "Order Confirmation",
      preheader: `Your order ${data.orderNumber} has been confirmed.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
            <p style="margin: 0 0 8px 0;">Thank you for your order. We have received your order and will begin processing it shortly.</p>`,
        },
        {
          title: "Order Summary",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Order Number</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #4ADE80; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${data.orderNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Payment Method</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.paymentMethod}</td>
            </tr>
            ${poLine}
          </table>`,
        },
        {
          title: "Items",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 2px solid #1E3A4C;">
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Item</td>
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">Qty</td>
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Price</td>
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Total</td>
            </tr>
            ${itemRows}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="padding: 4px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-align: right;">Subtotal</td>
              <td style="padding: 4px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right; width: 100px;">${formatCurrency(data.subtotal)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-align: right;">Shipping</td>
              <td style="padding: 4px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right; width: 100px;">${formatCurrency(data.shipping)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif; text-align: right;">GST</td>
              <td style="padding: 4px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right; width: 100px;">${formatCurrency(data.gst)}</td>
            </tr>
            <tr style="border-top: 2px solid #1E3A4C;">
              <td style="padding: 8px 12px; font-size: 16px; font-weight: 700; color: #FFFFFF; font-family: Arial, Helvetica, sans-serif; text-align: right;">Total</td>
              <td style="padding: 8px 12px; font-size: 16px; font-weight: 700; color: #4ADE80; font-family: Arial, Helvetica, sans-serif; text-align: right; width: 100px;">${formatCurrency(data.total)}</td>
            </tr>
          </table>`,
        },
      ],
      ctaButton: {
        text: "View Order Details",
        url: `${APP_URL}/dashboard/orders`,
      },
      footerNote:
        "If you have any questions about your order, please contact our support team.",
    })
  } catch (error) {
    console.error("Failed to send order confirmation email:", error)
  }
}

export async function sendOrderStatusUpdateEmail(
  customerEmail: string,
  data: {
    customerName: string
    orderNumber: string
    status: string
    trackingNumber?: string
  },
) {
  try {
    const statusLabel = formatStatus(data.status)
    const colors = orderStatusColors[data.status] || { bg: "#4ADE80", text: "#1C1917" }
    const trackingRow = data.trackingNumber
      ? `<tr>
          <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Tracking Number</td>
          <td style="padding: 6px 12px; font-size: 14px; color: #4ADE80; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${data.trackingNumber}</td>
        </tr>`
      : ""

    await sendEmail({
      to: customerEmail,
      subject: `Order ${data.orderNumber} - ${statusLabel} - Chem Connect`,
      heading: "Order Status Update",
      preheader: `Your order ${data.orderNumber} is now ${statusLabel}.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
            <p style="margin: 0 0 8px 0;">Your order status has been updated.</p>`,
        },
        {
          title: "Order Details",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Order Number</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.orderNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Status</td>
              <td style="padding: 8px 12px;">${statusBadge(statusLabel, colors)}</td>
            </tr>
            ${trackingRow}
          </table>`,
        },
      ],
      ctaButton: {
        text: "View Order",
        url: `${APP_URL}/dashboard/orders`,
      },
    })
  } catch (error) {
    console.error("Failed to send order status update email:", error)
  }
}

export async function sendPaymentSuccessEmail(
  customerEmail: string,
  data: {
    customerName: string
    orderNumber: string
    amount: number
  },
) {
  try {
    await sendEmail({
      to: customerEmail,
      subject: `Payment Received - ${data.orderNumber} - Chem Connect`,
      heading: "Payment Successful",
      preheader: `We received your payment of ${formatCurrency(data.amount)} for order ${data.orderNumber}.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
            <p style="margin: 0 0 8px 0;">We have successfully received your payment. Your order is now being processed.</p>`,
        },
        {
          title: "Payment Details",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Order Number</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Amount Paid</td>
              <td style="padding: 6px 12px; font-size: 16px; font-weight: 700; color: #4ADE80; font-family: Arial, Helvetica, sans-serif;">${formatCurrency(data.amount)}</td>
            </tr>
          </table>`,
        },
      ],
      ctaButton: {
        text: "View Order",
        url: `${APP_URL}/dashboard/orders`,
      },
    })
  } catch (error) {
    console.error("Failed to send payment success email:", error)
  }
}

export async function sendPaymentFailedEmail(
  customerEmail: string,
  data: {
    customerName: string
    orderNumber: string
    amount: number
  },
) {
  try {
    await sendEmail({
      to: customerEmail,
      subject: `Payment Failed - ${data.orderNumber} - Chem Connect`,
      heading: "Payment Failed",
      preheader: `Your payment of ${formatCurrency(data.amount)} for order ${data.orderNumber} could not be processed.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${data.customerName},</p>
            <p style="margin: 0 0 8px 0;">Unfortunately, we were unable to process your payment. Please check your payment details and try again.</p>`,
        },
        {
          title: "Payment Details",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Order Number</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Amount</td>
              <td style="padding: 6px 12px; font-size: 16px; font-weight: 700; color: #EF4444; font-family: Arial, Helvetica, sans-serif;">${formatCurrency(data.amount)}</td>
            </tr>
          </table>`,
        },
      ],
      ctaButton: {
        text: "Retry Payment",
        url: `${APP_URL}/dashboard/orders`,
      },
      footerNote:
        "If you continue to experience issues, please contact our support team for assistance.",
    })
  } catch (error) {
    console.error("Failed to send payment failed email:", error)
  }
}

export async function notifyAdminNewOrder(data: {
  customerName: string
  customerEmail: string
  companyName?: string
  orderNumber: string
  total: number
  paymentMethod: string
  itemCount: number
}) {
  try {
    const enabled = await isEmailEnabled()
    if (!enabled) return

    const adminEmail = await getAdminEmail()
    if (!adminEmail) {
      console.error("No admin support email configured - skipping admin notification")
      return
    }

    const companyRow = data.companyName
      ? `<tr style="border-bottom: 1px solid #1E3A4C;">
          <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Company</td>
          <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.companyName}</td>
        </tr>`
      : ""

    await sendEmail({
      to: adminEmail,
      subject: `New Order ${data.orderNumber} from ${data.customerName}`,
      heading: "New Order Received",
      preheader: `${data.customerName} placed order ${data.orderNumber} for ${formatCurrency(data.total)}.`,
      sections: [
        {
          title: "Customer",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Name</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.customerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Email</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.customerEmail}</td>
            </tr>
            ${companyRow}
          </table>`,
        },
        {
          title: "Order Details",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Order Number</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #4ADE80; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${data.orderNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Items</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.itemCount} item${data.itemCount !== 1 ? "s" : ""}</td>
            </tr>
            <tr style="border-bottom: 1px solid #1E3A4C;">
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Payment Method</td>
              <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">Total</td>
              <td style="padding: 6px 12px; font-size: 16px; font-weight: 700; color: #4ADE80; font-family: Arial, Helvetica, sans-serif;">${formatCurrency(data.total)}</td>
            </tr>
          </table>`,
        },
      ],
      ctaButton: {
        text: "View in Admin Panel",
        url: `${APP_URL}/admin/orders`,
      },
    })
  } catch (error) {
    console.error("Failed to send admin new order notification:", error)
  }
}
