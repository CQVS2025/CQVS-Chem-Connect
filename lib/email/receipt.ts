const LOGO_URL =
  "https://fsjlulqlvxvfgkycdrrd.supabase.co/storage/v1/object/public/product-images/Logo/cqvs-logo.png"

interface ReceiptData {
  orderNumber: string
  date: string
  customerName: string
  companyName?: string
  customerEmail: string
  items: {
    name: string
    qty: number
    unit: string
    packagingSize: string
    unitPrice: number
    total: number
    shippingFee?: number
  }[]
  subtotal: number
  shipping: number
  gst: number
  processingFee?: number
  total: number
  paymentMethod: string
  poNumber?: string
  deliveryAddress?: string
  stripeReceiptUrl?: string
  supportEmail?: string
}

/**
 * Build a branded HTML receipt/invoice that can be attached as an email
 * or rendered as a standalone page.
 */
export function buildReceiptHtml(data: ReceiptData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 12px; font-size: 13px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; border-bottom: 1px solid #1E3A4C;">
          ${item.name}<br/>
          <span style="color: #94A3B8; font-size: 11px;">${item.packagingSize}</span>
        </td>
        <td style="padding: 10px 12px; font-size: 13px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: center; border-bottom: 1px solid #1E3A4C;">${item.qty}</td>
        <td style="padding: 10px 12px; font-size: 13px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right; border-bottom: 1px solid #1E3A4C;">AUD ${item.unitPrice.toFixed(2)}/${item.unit}</td>
        <td style="padding: 10px 12px; font-size: 13px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right; border-bottom: 1px solid #1E3A4C;">AUD ${item.total.toFixed(2)}</td>
      </tr>`,
    )
    .join("")

  const poLine = data.poNumber
    ? `<tr>
        <td style="padding: 6px 0; font-size: 13px; color: #94A3B8;">PO Number:</td>
        <td style="padding: 6px 0; font-size: 13px; color: #E5E7EB; text-align: right;">${data.poNumber}</td>
       </tr>`
    : ""

  const deliveryLine = data.deliveryAddress
    ? `<tr>
        <td style="padding: 6px 0; font-size: 13px; color: #94A3B8;">Delivery:</td>
        <td style="padding: 6px 0; font-size: 13px; color: #E5E7EB; text-align: right;">${data.deliveryAddress}</td>
       </tr>`
    : ""

  const stripeReceiptLine = data.stripeReceiptUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
        <tr>
          <td align="center">
            <a href="${data.stripeReceiptUrl}" target="_blank" style="display: inline-block; padding: 10px 24px; background-color: #1E3A4C; color: #E5E7EB; text-decoration: none; border-radius: 6px; font-size: 13px; font-family: Arial, Helvetica, sans-serif; border: 1px solid #2A4A5C;">
              View Stripe Receipt
            </a>
          </td>
        </tr>
       </table>`
    : ""

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${data.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0D1F2D; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0D1F2D;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #132A38 0%, #173241 100%); border-radius: 12px 12px 0 0; padding: 30px; border-bottom: 2px solid #4ADE80;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <img src="${LOGO_URL}" alt="CQVS" width="40" height="40" style="border-radius: 8px; vertical-align: middle;" />
                    <span style="margin-left: 12px; font-size: 20px; font-weight: 700; color: #FFFFFF; vertical-align: middle; font-family: Arial, Helvetica, sans-serif;">Chem Connect</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: ${data.paymentMethod === "Purchase Order" ? "#F59E0B" : "#4ADE80"}; color: #0D1F2D; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, Helvetica, sans-serif;">
                      ${data.paymentMethod === "Purchase Order" ? "PURCHASE ORDER" : "RECEIPT"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #132A38; padding: 30px;">

              <!-- Order info -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 13px; color: #94A3B8; padding: 6px 0; font-family: Arial, Helvetica, sans-serif;">Order Number:</td>
                  <td style="font-size: 13px; color: #4ADE80; font-weight: 600; padding: 6px 0; text-align: right; font-family: Arial, Helvetica, sans-serif;">${data.orderNumber}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #94A3B8; padding: 6px 0; font-family: Arial, Helvetica, sans-serif;">Date:</td>
                  <td style="font-size: 13px; color: #E5E7EB; padding: 6px 0; text-align: right; font-family: Arial, Helvetica, sans-serif;">${data.date}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #94A3B8; padding: 6px 0; font-family: Arial, Helvetica, sans-serif;">Payment:</td>
                  <td style="font-size: 13px; color: #E5E7EB; padding: 6px 0; text-align: right; font-family: Arial, Helvetica, sans-serif;">${data.paymentMethod}</td>
                </tr>
                ${poLine}
                ${deliveryLine}
              </table>

              <!-- Bill to -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #173241; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 4px 0; font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, Helvetica, sans-serif;">Bill To</p>
                    <p style="margin: 0 0 2px 0; font-size: 14px; color: #FFFFFF; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">${data.customerName}</p>
                    ${data.companyName ? `<p style="margin: 0 0 2px 0; font-size: 13px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${data.companyName}</p>` : ""}
                    <p style="margin: 0; font-size: 13px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">${data.customerEmail}</p>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr style="border-bottom: 2px solid #1E3A4C;">
                  <td style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, Helvetica, sans-serif;">Item</td>
                  <td style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; font-family: Arial, Helvetica, sans-serif;">Qty</td>
                  <td style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; font-family: Arial, Helvetica, sans-serif;">Price</td>
                  <td style="padding: 8px 12px; font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; text-align: right; font-family: Arial, Helvetica, sans-serif;">Total</td>
                </tr>
                ${itemRows}
              </table>

              <!-- Totals -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #94A3B8; text-align: right; font-family: Arial, Helvetica, sans-serif;">Subtotal</td>
                  <td style="padding: 4px 12px; font-size: 13px; color: #E5E7EB; text-align: right; width: 100px; font-family: Arial, Helvetica, sans-serif;">AUD ${data.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #94A3B8; text-align: right; font-family: Arial, Helvetica, sans-serif;">Shipping</td>
                  <td style="padding: 4px 12px; font-size: 13px; color: #E5E7EB; text-align: right; width: 100px; font-family: Arial, Helvetica, sans-serif;">${data.shipping === 0 ? "Free" : "AUD " + data.shipping.toFixed(2)}</td>
                </tr>
                ${data.shipping > 0 ? data.items.map((item) => `<tr>
                  <td style="padding: 1px 12px; font-size: 11px; color: #64748B; text-align: right; font-family: Arial, Helvetica, sans-serif;">${item.name}</td>
                  <td style="padding: 1px 12px; font-size: 11px; color: #64748B; text-align: right; width: 100px; font-family: Arial, Helvetica, sans-serif;">${(item.shippingFee ?? 0) > 0 ? "AUD " + item.shippingFee!.toFixed(2) : "Free"}</td>
                </tr>`).join("") : ""}
                <tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #94A3B8; text-align: right; font-family: Arial, Helvetica, sans-serif;">GST (10%)</td>
                  <td style="padding: 4px 12px; font-size: 13px; color: #E5E7EB; text-align: right; width: 100px; font-family: Arial, Helvetica, sans-serif;">AUD ${data.gst.toFixed(2)}</td>
                </tr>
                ${data.processingFee && data.processingFee > 0 ? `<tr>
                  <td style="padding: 4px 12px; font-size: 13px; color: #94A3B8; text-align: right; font-family: Arial, Helvetica, sans-serif;">Card Processing Fee</td>
                  <td style="padding: 4px 12px; font-size: 13px; color: #E5E7EB; text-align: right; width: 100px; font-family: Arial, Helvetica, sans-serif;">AUD ${data.processingFee.toFixed(2)}</td>
                </tr>` : ""}
                <tr>
                  <td colspan="2" style="padding-top: 8px;"><hr style="border: none; border-top: 2px solid #1E3A4C; margin: 0;"/></td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 18px; font-weight: 700; color: #FFFFFF; text-align: right; font-family: Arial, Helvetica, sans-serif;">Total</td>
                  <td style="padding: 8px 12px; font-size: 18px; font-weight: 700; color: #4ADE80; text-align: right; width: 100px; font-family: Arial, Helvetica, sans-serif;">AUD ${data.total.toFixed(2)}</td>
                </tr>
              </table>

              <!-- Stripe receipt link -->
              ${stripeReceiptLine}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F2231; border-radius: 0 0 12px 12px; padding: 20px 30px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">
                Chem Connect by CQVS - Premium Chemical Supply Solutions
              </p>
              <p style="margin: 0; font-size: 11px; color: #64748B; font-family: Arial, Helvetica, sans-serif;">
                ${data.supportEmail ? `<a href="mailto:${data.supportEmail}" style="color: #64748B; text-decoration: none;">${data.supportEmail}</a> | ` : ""}https://www.cqvs-chemconnect.com.au
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
