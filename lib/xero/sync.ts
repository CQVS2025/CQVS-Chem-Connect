/**
 * High-level Xero sync helpers - sit on top of the low-level client.
 *
 * These functions handle:
 *  - Profile -> Xero contact mapping
 *  - PO order -> Xero invoice creation
 *  - Persisting Xero IDs back to our database
 *  - Logging every attempt to xero_sync_log
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  getXeroClient,
  logXeroSync,
  XeroApiError,
  type XeroContactInput,
  type XeroLineItem,
  type XeroInvoiceInput,
  type XeroPurchaseOrderInput,
} from "@/lib/xero/client"

interface ProfileForSync {
  id: string
  email: string
  invoice_email: string | null
  company_name: string | null
  contact_name: string | null
  phone: string | null
  abn: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_postcode: string | null
  xero_contact_id: string | null
}

/**
 * Build a Xero contact payload from a profile row.
 */
function buildContactPayload(profile: ProfileForSync): XeroContactInput {
  const [firstName, ...rest] = (profile.contact_name || "").split(" ")
  const lastName = rest.join(" ") || undefined

  return {
    Name: profile.company_name || profile.contact_name || profile.email,
    FirstName: firstName || undefined,
    LastName: lastName,
    EmailAddress: profile.invoice_email || profile.email,
    TaxNumber: profile.abn || undefined,
    IsCustomer: true,
    Addresses: profile.address_street
      ? [
          {
            AddressType: "STREET",
            AddressLine1: profile.address_street,
            City: profile.address_city || undefined,
            Region: profile.address_state || undefined,
            PostalCode: profile.address_postcode || undefined,
            Country: "Australia",
          },
        ]
      : undefined,
    Phones: profile.phone
      ? [{ PhoneType: "DEFAULT", PhoneNumber: profile.phone }]
      : undefined,
  }
}

/**
 * Sync a profile to Xero as a Contact (create or update).
 * Returns the Xero ContactID, or null if Xero is not connected.
 */
export async function syncProfileToXero(profileId: string): Promise<string | null> {
  const supabase = createServiceRoleClient()

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, email, invoice_email, company_name, contact_name, phone, abn, address_street, address_city, address_state, address_postcode, xero_contact_id",
    )
    .eq("id", profileId)
    .single()

  if (error || !profile) {
    await logXeroSync({
      entityType: "contact",
      entityId: profileId,
      action: "sync",
      status: "error",
      errorMessage: `Profile not found: ${error?.message ?? "unknown"}`,
    })
    return null
  }

  const xero = await getXeroClient()
  if (!xero) {
    // Xero not connected - log and skip
    await logXeroSync({
      entityType: "contact",
      entityId: profileId,
      action: "sync",
      status: "error",
      errorMessage: "Xero not connected",
    })
    return null
  }

  const payload = buildContactPayload(profile as ProfileForSync)

  try {
    // Always upsert by email - this is safer than passing a stored ContactID
    // because IDs are tenant-specific. If the user reconnects to a different
    // Xero org, the stored ID becomes invalid.
    const contact = await xero.upsertContactByEmail(payload)

    // Persist the Xero ID back
    await supabase
      .from("profiles")
      .update({ xero_contact_id: contact.ContactID })
      .eq("id", profileId)

    await logXeroSync({
      entityType: "contact",
      entityId: profileId,
      action: "sync",
      status: "success",
      xeroId: contact.ContactID,
      request: payload,
    })

    return contact.ContactID
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await logXeroSync({
      entityType: "contact",
      entityId: profileId,
      action: "sync",
      status: "error",
      errorMessage: message,
      request: payload,
    })
    return null
  }
}

/**
 * Create a Xero invoice for a PO order.
 *
 * Steps:
 *  1. Ensure the customer is a Xero contact (sync if needed)
 *  2. Build line items from order_items + container costs + shipping
 *  3. Create invoice as AUTHORISED with 30 day net due date
 *  4. Attach the uploaded PO document(s) if present
 *  5. Persist xero_invoice_id back to the order
 */
export async function createXeroInvoiceForOrder(
  orderId: string,
): Promise<{ invoiceId: string; invoiceNumber: string } | null> {
  const supabase = createServiceRoleClient()

  // Fetch order with items + customer profile
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      user_id,
      payment_method,
      po_number,
      invoice_email,
      subtotal,
      shipping,
      gst,
      container_total,
      total,
      created_at,
      delivery_address_street,
      delivery_address_city,
      delivery_address_state,
      delivery_address_postcode,
      order_items (
        product_name,
        quantity,
        packaging_size,
        unit_price,
        total_price,
        container_cost
      )
    `,
    )
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    await logXeroSync({
      entityType: "invoice",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: `Order not found: ${orderError?.message}`,
    })
    return null
  }

  // Get the customer profile + sync to Xero if needed
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, xero_contact_id, email, invoice_email")
    .eq("id", order.user_id)
    .single()

  if (!profile) {
    await logXeroSync({
      entityType: "invoice",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: "Customer profile not found",
    })
    return null
  }

  // Always re-sync the contact before creating an invoice. This is the
  // safest way to deal with stale IDs from a previous tenant or contact
  // updates - upsert by email will return the correct ContactID for the
  // current org. The cost is one extra API call per order which is fine.
  const contactId = await syncProfileToXero(profile.id)
  if (!contactId) {
    await logXeroSync({
      entityType: "invoice",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: "Could not resolve Xero contact for customer",
    })
    return null
  }

  const xero = await getXeroClient()
  if (!xero) {
    await logXeroSync({
      entityType: "invoice",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: "Xero not connected",
    })
    return null
  }

  // Build line items
  const lineItems: XeroLineItem[] = []

  // Tax type for sales invoices.
  // - For AU Xero orgs: "OUTPUT2" = "GST on Income" (10%)
  // - For non-AU demo orgs: set XERO_SALES_TAX_TYPE=NONE
  // The default is OUTPUT2 because production will be on an AU org.
  const GST_TAX_TYPE = process.env.XERO_SALES_TAX_TYPE || "OUTPUT2"
  // Currency code — defaults to AUD. Set XERO_CURRENCY to override, or
  // XERO_CURRENCY=AUTO to omit and let Xero use the org's base currency.
  const CURRENCY_CODE_RAW = process.env.XERO_CURRENCY || "AUD"
  const CURRENCY_CODE: string | undefined =
    CURRENCY_CODE_RAW === "AUTO" ? undefined : CURRENCY_CODE_RAW

  for (const item of order.order_items as Array<{
    product_name: string
    quantity: number
    packaging_size: string
    unit_price: number
    container_cost: number
  }>) {
    lineItems.push({
      Description: `${item.product_name} - ${item.packaging_size}`,
      Quantity: item.quantity,
      UnitAmount: Number(item.unit_price),
      AccountCode: process.env.XERO_REVENUE_ACCOUNT_CODE || "200",
      TaxType: GST_TAX_TYPE,
    })

    // Container cost as a separate line item if present
    if (item.container_cost && Number(item.container_cost) > 0) {
      lineItems.push({
        Description: `Container - ${item.packaging_size}`,
        Quantity: item.quantity,
        UnitAmount: Number(item.container_cost),
        AccountCode: process.env.XERO_REVENUE_ACCOUNT_CODE || "200",
        TaxType: GST_TAX_TYPE,
      })
    }
  }

  // Shipping line if present
  if (order.shipping && Number(order.shipping) > 0) {
    lineItems.push({
      Description: "Shipping",
      Quantity: 1,
      UnitAmount: Number(order.shipping),
      AccountCode: process.env.XERO_SHIPPING_ACCOUNT_CODE || "200",
      TaxType: GST_TAX_TYPE,
    })
  }

  // When using NONE tax type (demo / non-AU orgs), Xero won't auto-calculate
  // GST. Add it as an explicit line item so the Xero invoice total matches
  // the platform total. In real AU production with OUTPUT2, Xero handles this
  // automatically — so we skip this branch.
  if (GST_TAX_TYPE === "NONE" && order.gst && Number(order.gst) > 0) {
    lineItems.push({
      Description: "GST (10%)",
      Quantity: 1,
      UnitAmount: Number(order.gst),
      AccountCode: process.env.XERO_REVENUE_ACCOUNT_CODE || "200",
      TaxType: "NONE",
    })
  }

  // Date + due date (30 days net)
  const orderDate = new Date(order.created_at)
  const dueDate = new Date(orderDate)
  dueDate.setDate(dueDate.getDate() + 30)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const invoicePayload: XeroInvoiceInput = {
    Type: "ACCREC",
    Contact: { ContactID: contactId },
    LineItems: lineItems,
    Date: fmt(orderDate),
    DueDate: fmt(dueDate),
    Reference: order.po_number || order.order_number,
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
    ...(CURRENCY_CODE ? { CurrencyCode: CURRENCY_CODE } : {}),
  }

  try {
    const invoice = await xero.createInvoice(invoicePayload)

    await supabase
      .from("orders")
      .update({
        xero_invoice_id: invoice.InvoiceID,
        xero_invoice_number: invoice.InvoiceNumber,
        xero_invoice_status: invoice.Status,
        xero_synced_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    await logXeroSync({
      entityType: "invoice",
      entityId: orderId,
      action: "create",
      status: "success",
      xeroId: invoice.InvoiceID,
      request: invoicePayload,
      response: invoice,
    })

    // Attach uploaded PO documents (best effort, non-blocking on failure)
    await attachOrderDocumentsToInvoice(orderId, invoice.InvoiceID).catch(
      (err) => {
        console.error("Failed to attach PO docs to Xero invoice:", err)
      },
    )

    // Auto-send the invoice via email. Per the spec: "Auto-send (no manual review)".
    // Xero sends to the email addresses on the contact record - we set those
    // to the customer's invoice_email when syncing the contact.
    //
    // Known limitation: the Demo Company tenant blocks outbound emails and
    // returns a generic 500 from this endpoint. Production tenants work fine.
    try {
      await xero.emailInvoice(invoice.InvoiceID)
      await logXeroSync({
        entityType: "invoice_email",
        entityId: orderId,
        action: "send",
        status: "success",
        xeroId: invoice.InvoiceID,
      })
    } catch (err) {
      // Email failure is non-fatal - the invoice still exists in Xero and
      // can be sent manually from the Xero UI.
      const message = err instanceof Error ? err.message : "Unknown"
      const isDemoOrg500 =
        message.includes("(500)") &&
        message.toLowerCase().includes("an error occurred in xero")
      await logXeroSync({
        entityType: "invoice_email",
        entityId: orderId,
        action: "send",
        status: "error",
        xeroId: invoice.InvoiceID,
        errorMessage: isDemoOrg500
          ? `${message} - This is expected in Demo Company. Production tenants will send emails normally.`
          : message,
      })
    }

    return {
      invoiceId: invoice.InvoiceID,
      invoiceNumber: invoice.InvoiceNumber,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    // If this is a Xero API error, capture the full raw response so we can
    // see exactly which validation rule failed.
    let responsePayload: unknown = null
    if (err instanceof XeroApiError) {
      responsePayload = {
        status: err.status,
        validation_details: err.validationDetails,
        parsed: err.parsed,
        raw: err.rawBody,
      }
    }

    await logXeroSync({
      entityType: "invoice",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: message,
      request: invoicePayload,
      response: responsePayload,
    })
    return null
  }
}

/**
 * Create a Xero Purchase Order for a warehouse when an order is placed.
 * Uses warehouse-specific cost pricing (not customer-facing prices).
 *
 * This is sent to the warehouse as a supplier purchase order.
 */
export async function createXeroPurchaseOrderForOrder(
  orderId: string,
): Promise<{ poId: string; poNumber: string } | null> {
  const supabase = createServiceRoleClient()

  // Fetch order with items and warehouse info
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      warehouse_id,
      delivery_address_street,
      delivery_address_city,
      delivery_address_state,
      delivery_address_postcode,
      order_items (
        product_id,
        product_name,
        quantity,
        packaging_size,
        packaging_size_id,
        unit_price,
        total_price
      )
    `)
    .eq("id", orderId)
    .single()

  if (orderError || !order || !order.warehouse_id) {
    await logXeroSync({
      entityType: "purchase_order",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: `Order not found or no warehouse: ${orderError?.message ?? "no warehouse_id"}`,
    })
    return null
  }

  // Get warehouse with Xero contact ID
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, name, xero_contact_id, address_street, address_city, address_state, address_postcode")
    .eq("id", order.warehouse_id)
    .single()

  if (!warehouse || !warehouse.xero_contact_id) {
    await logXeroSync({
      entityType: "purchase_order",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: `Warehouse not found or missing Xero contact ID. Configure Xero Contact ID for the warehouse in admin.`,
    })
    return null
  }

  const xero = await getXeroClient()
  if (!xero) {
    await logXeroSync({
      entityType: "purchase_order",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: "Xero not connected",
    })
    return null
  }

  // Get warehouse-specific cost prices for each product + packaging size
  const items = order.order_items as Array<{
    product_id: string
    product_name: string
    quantity: number
    packaging_size: string
    packaging_size_id: string | null
    unit_price: number
    total_price: number
  }>

  const productIds = items.map((i) => i.product_id)
  const { data: warehousePricing } = await supabase
    .from("warehouse_product_pricing")
    .select("product_id, packaging_size_id, cost_price")
    .eq("warehouse_id", order.warehouse_id)
    .in("product_id", productIds)

  const pricingMap = new Map<string, number>()
  for (const p of (warehousePricing ?? [])) {
    pricingMap.set(`${p.product_id}:${p.packaging_size_id ?? ""}`, Number(p.cost_price))
  }

  // - For AU Xero orgs: "INPUT2" = "GST on Expenses" (10%)
  // - For non-AU demo orgs: set XERO_PURCHASE_TAX_TYPE=NONE
  const GST_TAX_TYPE = process.env.XERO_PURCHASE_TAX_TYPE || "INPUT2"
  const PURCHASE_ACCOUNT = process.env.XERO_PURCHASE_ACCOUNT_CODE || "300"
  const CURRENCY_CODE_RAW = process.env.XERO_CURRENCY || "AUD"
  const CURRENCY_CODE: string | undefined =
    CURRENCY_CODE_RAW === "AUTO" ? undefined : CURRENCY_CODE_RAW

  const lineItems: XeroLineItem[] = items.map((item) => {
    const pricingKey = `${item.product_id}:${item.packaging_size_id ?? ""}`
    const costPrice = pricingMap.get(pricingKey) ?? Number(item.unit_price) // fall back to customer price
    return {
      Description: `${item.product_name} - ${item.packaging_size}`,
      Quantity: item.quantity,
      UnitAmount: costPrice,
      AccountCode: PURCHASE_ACCOUNT,
      TaxType: GST_TAX_TYPE,
    }
  })

  // When using NONE tax type (demo / non-AU orgs), Xero won't auto-calculate
  // GST. Add it as an explicit line item so the PO total includes GST.
  // In real AU production with INPUT2, Xero handles this automatically.
  if (GST_TAX_TYPE === "NONE") {
    const subtotal = lineItems.reduce(
      (sum, li) => sum + (li.UnitAmount ?? 0) * (li.Quantity ?? 1),
      0,
    )
    const gstAmount = Math.round(subtotal * 0.1 * 100) / 100
    if (gstAmount > 0) {
      lineItems.push({
        Description: "GST (10%)",
        Quantity: 1,
        UnitAmount: gstAmount,
        AccountCode: PURCHASE_ACCOUNT,
        TaxType: "NONE",
      })
    }
  }

  const orderDate = new Date()
  const deliveryDate = new Date(orderDate)
  deliveryDate.setDate(deliveryDate.getDate() + 14) // default 14-day delivery estimate

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const poPayload: XeroPurchaseOrderInput = {
    Contact: { ContactID: warehouse.xero_contact_id },
    LineItems: lineItems,
    Date: fmt(orderDate),
    DeliveryDate: fmt(deliveryDate),
    Reference: order.order_number,
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
    ...(CURRENCY_CODE ? { CurrencyCode: CURRENCY_CODE } : {}),
    DeliveryAddress: [
      order.delivery_address_street,
      order.delivery_address_city,
      order.delivery_address_state,
      order.delivery_address_postcode,
    ]
      .filter(Boolean)
      .join(", "),
    AttentionTo: `Order ${order.order_number} - Customer Delivery`,
  }

  try {
    const po = await xero.createPurchaseOrder(poPayload)

    await supabase
      .from("orders")
      .update({
        xero_po_id: po.PurchaseOrderID,
        xero_po_number: po.PurchaseOrderNumber,
        xero_synced_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    await logXeroSync({
      entityType: "purchase_order",
      entityId: orderId,
      action: "create",
      status: "success",
      xeroId: po.PurchaseOrderID,
      request: poPayload,
      response: po,
    })

    // Email the PO to the warehouse so they get notified automatically.
    // PO is AUTHORISED — warehouse can act on it immediately, no manual
    // approval required in Xero.
    try {
      await xero.emailPurchaseOrder(po.PurchaseOrderID)
    } catch (emailErr) {
      console.warn("[Xero] PO created but email to warehouse failed:", emailErr)
    }

    return {
      poId: po.PurchaseOrderID,
      poNumber: po.PurchaseOrderNumber,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await logXeroSync({
      entityType: "purchase_order",
      entityId: orderId,
      action: "create",
      status: "error",
      errorMessage: message,
      request: poPayload,
    })
    return null
  }
}

/**
 * Download any uploaded order documents (typically the customer's PO PDF)
 * and attach them to the Xero invoice.
 */
async function attachOrderDocumentsToInvoice(
  orderId: string,
  invoiceId: string,
): Promise<void> {
  const supabase = createServiceRoleClient()

  const { data: docs } = await supabase
    .from("order_documents")
    .select("file_name, file_url, file_type")
    .eq("order_id", orderId)

  if (!docs || docs.length === 0) return

  const xero = await getXeroClient()
  if (!xero) return

  for (const doc of docs as Array<{
    file_name: string
    file_url: string
    file_type: string
  }>) {
    try {
      // file_url stores the storage path within the bucket
      const { data: blob, error } = await supabase.storage
        .from("order-documents")
        .download(doc.file_url)

      if (error || !blob) continue

      const arrayBuffer = await blob.arrayBuffer()
      await xero.attachFileToInvoice(
        invoiceId,
        doc.file_name,
        doc.file_type || "application/octet-stream",
        arrayBuffer,
      )

      await logXeroSync({
        entityType: "invoice_attachment",
        entityId: orderId,
        action: "attach",
        status: "success",
        xeroId: invoiceId,
      })
    } catch (err) {
      await logXeroSync({
        entityType: "invoice_attachment",
        entityId: orderId,
        action: "attach",
        status: "error",
        xeroId: invoiceId,
        errorMessage: err instanceof Error ? err.message : "Unknown",
      })
    }
  }
}
