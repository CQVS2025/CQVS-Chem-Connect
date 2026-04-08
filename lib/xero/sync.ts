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
      TaxType: "OUTPUT",
    })

    // Container cost as a separate line item if present
    if (item.container_cost && Number(item.container_cost) > 0) {
      lineItems.push({
        Description: `Container - ${item.packaging_size}`,
        Quantity: item.quantity,
        UnitAmount: Number(item.container_cost),
        AccountCode: process.env.XERO_REVENUE_ACCOUNT_CODE || "200",
        TaxType: "OUTPUT",
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
      TaxType: "OUTPUT",
    })
  }

  // Date + due date (30 days net)
  const orderDate = new Date(order.created_at)
  const dueDate = new Date(orderDate)
  dueDate.setDate(dueDate.getDate() + 30)

  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const invoicePayload = {
    Type: "ACCREC" as const,
    Contact: { ContactID: contactId },
    LineItems: lineItems,
    Date: fmt(orderDate),
    DueDate: fmt(dueDate),
    Reference: order.po_number || order.order_number,
    Status: "AUTHORISED" as const,
    LineAmountTypes: "Exclusive" as const,
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
