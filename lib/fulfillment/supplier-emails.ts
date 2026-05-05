// Emails for the supplier-managed fulfillment flow.
//
//   sendSupplierPurchaseOrderEmail   - fired on order placement to all
//                                      warehouse_users with receives_po_emails
//                                      = true (component 8).
//   sendBuyerSupplierUpdateEmail     - fired when the supplier first sets
//                                      or later changes dispatch_date or
//                                      ETA (component 13).
//   sendVarianceFlagEmails           - admin + buyer notification when
//                                      the supplier-confirmed freight drifts
//                                      past the variance threshold
//                                      (component 16).
//
// All emails are Chem Connect branded (component 9 / Q7) and routed
// through the shared Mailgun config in lib/email/send.ts.

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail, getAdminEmail } from "@/lib/email/send"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

function fmt(label: string, value: string | null | undefined): string {
  if (!value) return ""
  return `<tr style="border-bottom: 1px solid #1E3A4C;">
    <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">${label}</td>
    <td style="padding: 6px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${value}</td>
  </tr>`
}

function renderSiteAccessAnswers(answers: Record<string, unknown> | null): string {
  if (!answers || typeof answers !== "object") return "<p>None recorded.</p>"
  const rows = Object.entries(answers)
    .map(([key, val]) => {
      const v = typeof val === "object" ? JSON.stringify(val) : String(val ?? "")
      return fmt(key, v)
    })
    .join("\n")
  if (!rows) return "<p>None recorded.</p>"
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">${rows}</table>`
}

export interface SendPurchaseOrderArgs {
  supabase: SupabaseClient
  orderId: string
}

export async function sendSupplierPurchaseOrderEmail(
  args: SendPurchaseOrderArgs,
): Promise<void> {
  const { supabase, orderId } = args

  // Pull order + items + buyer profile + warehouse users
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, warehouse_id, total, shipping, gst, subtotal,
       delivery_address_street, delivery_address_city, delivery_address_state,
       delivery_address_postcode, delivery_notes, site_access_answers, user_id,
       order_items (product_id, product_name, quantity, packaging_size, unit_price, total_price)`,
    )
    .eq("id", orderId)
    .single()
  if (error || !order) {
    console.error("[supplier PO email] order not found:", orderId, error)
    return
  }

  if (!order.warehouse_id) return

  const { data: recipients } = await supabase
    .from("warehouse_users")
    .select("user_id, receives_po_emails")
    .eq("warehouse_id", order.warehouse_id)
    .eq("receives_po_emails", true)

  if (!recipients || recipients.length === 0) {
    console.warn(
      `[supplier PO email] no recipients for warehouse ${order.warehouse_id}`,
    )
    return
  }

  const userIds = recipients.map((r: { user_id: string }) => r.user_id)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, contact_name")
    .in("id", userIds)

  const { data: buyerProfile } = await supabase
    .from("profiles")
    .select("contact_name, email, company_name, phone")
    .eq("id", order.user_id)
    .single()

  const itemRows = (order.order_items ?? [])
    .map(
      (it: {
        product_name: string
        quantity: number
        packaging_size: string
      }) =>
        `<tr style="border-bottom: 1px solid #1E3A4C;">
          <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${it.product_name}</td>
          <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif;">${it.packaging_size}</td>
          <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-family: Arial, Helvetica, sans-serif; text-align: right;">${it.quantity}</td>
        </tr>`,
    )
    .join("")

  const dashboardUrl = `${APP_URL}/supplier/orders/${order.id}`
  const deliveryAddress = [
    order.delivery_address_street,
    order.delivery_address_city,
    order.delivery_address_state,
    order.delivery_address_postcode,
  ]
    .filter(Boolean)
    .join(", ")

  for (const profile of profiles ?? []) {
    const p = profile as {
      id: string
      email: string
      contact_name: string | null
    }
    if (!p.email) continue
    await sendEmail({
      to: p.email,
      subject: `New Purchase Order ${order.order_number} - Chem Connect`,
      heading: "New Purchase Order",
      preheader: `${order.order_number}: ${(order.order_items ?? []).length} item(s) for ${deliveryAddress || "delivery"}.`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">Hi ${p.contact_name ?? "Supplier"},</p>
            <p style="margin: 0 0 8px 0;">A new purchase order has been placed on Chem Connect for fulfillment from your warehouse.</p>`,
        },
        {
          title: "Order",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            ${fmt("Order Number", order.order_number)}
            ${fmt("Buyer", buyerProfile?.contact_name ?? null)}
            ${fmt("Company", buyerProfile?.company_name ?? null)}
            ${fmt("Buyer Email", buyerProfile?.email ?? null)}
            ${fmt("Buyer Phone", buyerProfile?.phone ?? null)}
            ${fmt("Delivery Address", deliveryAddress)}
            ${fmt("Notes", order.delivery_notes)}
          </table>`,
        },
        {
          title: "Items",
          content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">
            <tr style="border-bottom: 2px solid #1E3A4C;">
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8;">Product</td>
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8;">Packaging</td>
              <td style="padding: 8px 12px; font-size: 12px; font-weight: 600; color: #94A3B8; text-align: right;">Qty</td>
            </tr>
            ${itemRows}
          </table>`,
        },
        {
          title: "Site Access",
          content: renderSiteAccessAnswers(
            order.site_access_answers as Record<string, unknown> | null,
          ),
        },
      ],
      ctaButton: {
        text: "Open in Supplier Dashboard",
        url: dashboardUrl,
      },
      footerNote:
        "Please confirm dispatch and an estimated delivery date in the supplier dashboard. The buyer is automatically notified.",
    })
  }
}

export interface SendBuyerSupplierUpdateArgs {
  supabase: SupabaseClient
  orderId: string
  changedField: "dispatch_date" | "estimated_delivery" | "tracking_url"
  value: string | null
}

export async function sendBuyerSupplierUpdateEmail(
  args: SendBuyerSupplierUpdateArgs,
): Promise<void> {
  const { supabase, orderId, changedField, value } = args

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, user_id")
    .eq("id", orderId)
    .single()
  if (!order) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_name, email")
    .eq("id", order.user_id)
    .single()
  if (!profile?.email) return

  const fieldLabel =
    changedField === "dispatch_date"
      ? "Dispatch Date"
      : changedField === "estimated_delivery"
        ? "Estimated Delivery"
        : "Tracking Link"

  // Tracking-link emails get a slightly different body - surface the
  // URL prominently and link out to the supplier's portal directly.
  const isTracking = changedField === "tracking_url"
  const updateRow = isTracking
    ? value
      ? `<tr style="border-bottom: 1px solid #1E3A4C;">
          <td style="padding: 6px 12px; font-size: 14px; color: #94A3B8; font-family: Arial, Helvetica, sans-serif;">${fieldLabel}</td>
          <td style="padding: 6px 12px; font-size: 14px;"><a href="${value}" style="color: #4ADE80; text-decoration: underline; word-break: break-all;">${value}</a></td>
        </tr>`
      : fmt(fieldLabel, "Removed")
    : fmt(fieldLabel, value ?? "Not set")

  await sendEmail({
    to: profile.email,
    subject: `Order ${order.order_number} - ${fieldLabel} Updated`,
    heading: `${fieldLabel} Updated`,
    preheader: isTracking
      ? value
        ? `Tracking link added for order ${order.order_number}.`
        : `Tracking link removed for order ${order.order_number}.`
      : `${fieldLabel} for order ${order.order_number} is now ${value ?? "unset"}.`,
    sections: [
      {
        content: `<p>Hi ${profile.contact_name ?? "there"},</p>
          <p>${
            isTracking
              ? value
                ? `The supplier has added a tracking link for your order <strong>${order.order_number}</strong>. Click below to follow your shipment.`
                : `The supplier has removed the tracking link for your order <strong>${order.order_number}</strong>. Status updates will continue via the supplier dispatch panel on your order page.`
              : `The supplier has updated the ${fieldLabel.toLowerCase()} for your order <strong>${order.order_number}</strong>.`
          }</p>`,
      },
      {
        title: "Update",
        content: `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;">${updateRow}</table>`,
      },
    ],
    ctaButton: {
      text: isTracking && value ? "Track Shipment" : "View Order",
      url: isTracking && value
        ? value
        : `${APP_URL}/dashboard/orders?order=${order.id}`,
    },
  })

  // Persist what we've emailed so a date/URL save with the same value
  // doesn't re-fire. dispatch_date / eta have dedicated columns; the
  // tracking URL piggybacks off `last_emailed_at` only because we
  // already fire the email gated on a value-change diff at the caller.
  await supabase.from("order_supplier_notification_state").upsert(
    {
      order_id: orderId,
      ...(changedField === "dispatch_date"
        ? { last_dispatch_date_emailed: value }
        : changedField === "estimated_delivery"
          ? { last_eta_emailed: value }
          : {}),
      last_emailed_at: new Date().toISOString(),
    },
    { onConflict: "order_id" },
  )
}

export interface SendVarianceFlagArgs {
  supabase: SupabaseClient
  orderId: string
  quotedFreight: number
  recalculatedFreight: number
  delta: number
  threshold: number
}

export interface SendClaimDecisionArgs {
  supabase: SupabaseClient
  claimId: string
}

/**
 * Notify the supplier (and admin) when a freight variance claim has been
 * approved or rejected. Approved claims tell the supplier they can invoice
 * the higher amount; admin gets a reminder that the Xero Bill (not the PO)
 * needs the freight line bumped when "Mark as billed" is clicked.
 */
export async function sendClaimDecisionEmails(
  args: SendClaimDecisionArgs,
): Promise<void> {
  const { supabase, claimId } = args

  const { data: claim } = await supabase
    .from("freight_variance_claims")
    .select(
      `id, order_id, warehouse_id, claimed_amount, status, decision_note,
       reviewed_at, claimed_by,
       orders!inner(order_number, shipping, xero_po_number),
       warehouses!inner(name, contact_email)`,
    )
    .eq("id", claimId)
    .single<{
      id: string
      order_id: string
      warehouse_id: string
      claimed_amount: number
      status: "approved" | "rejected" | "pending"
      decision_note: string | null
      reviewed_at: string | null
      claimed_by: string
      orders: {
        order_number: string
        shipping: number | null
        xero_po_number: string | null
      }
      warehouses: { name: string; contact_email: string | null }
    }>()
  if (!claim) return
  if (claim.status !== "approved" && claim.status !== "rejected") return

  const adminEmail = await getAdminEmail()
  const quoted = Number(claim.orders.shipping ?? 0)
  const approved = Number(claim.claimed_amount)
  const variance = approved - quoted

  // Recipients: the supplier user who raised it + warehouse contact_email
  // (so the supplier billing inbox gets a copy).
  const supplierTos = new Set<string>()
  const { data: claimant } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", claim.claimed_by)
    .single()
  if (claimant?.email) supplierTos.add(claimant.email)
  if (claim.warehouses.contact_email)
    supplierTos.add(claim.warehouses.contact_email)

  const summary = `<table width="100%">
      ${fmt("Order", claim.orders.order_number)}
      ${fmt("Xero PO", claim.orders.xero_po_number ?? "Not yet created")}
      ${fmt("Warehouse", claim.warehouses.name)}
      ${fmt("Quoted freight (PO)", `AUD ${quoted.toFixed(2)}`)}
      ${fmt(
        claim.status === "approved" ? "Approved freight" : "Rejected at",
        claim.status === "approved"
          ? `AUD ${approved.toFixed(2)}`
          : `AUD ${approved.toFixed(2)} (claim rejected - pay quoted amount)`,
      )}
      ${
        claim.status === "approved"
          ? fmt("Variance", `AUD ${variance.toFixed(2)}`)
          : ""
      }
      ${claim.decision_note ? fmt("Admin note", claim.decision_note) : ""}
    </table>`

  // ---- Supplier copy --------------------------------------------------
  // sendEmail only accepts a single recipient - fan out one message per
  // unique supplier address.
  if (claim.status === "approved") {
    for (const to of supplierTos) {
      await sendEmail({
        to,
        subject: `Freight variance approved - ${claim.orders.order_number}`,
        heading: "Variance Claim Approved",
        preheader: `Your freight variance claim was approved at AUD ${approved.toFixed(2)}.`,
        sections: [
          {
            content: `<p>Your freight variance claim has been approved. You can invoice Chem Connect at the approved freight amount instead of the original PO freight.</p>
              <p>The original Purchase Order remains as-is for the audit trail. When the PO is converted to a Bill in Xero, Chem Connect will adjust the freight line on the Bill to match the approved amount.</p>`,
          },
          { title: "Summary", content: summary },
        ],
      }).catch((err) => {
        console.error("[claim decision] supplier approved email failed:", err)
      })
    }
  }

  if (claim.status === "rejected") {
    for (const to of supplierTos) {
      await sendEmail({
        to,
        subject: `Freight variance rejected - ${claim.orders.order_number}`,
        heading: "Variance Claim Rejected",
        preheader: `Your freight variance claim was not approved.`,
        sections: [
          {
            content: `<p>Your freight variance claim has been reviewed and not approved. You will be paid the originally quoted freight amount as set out in the Purchase Order.</p>`,
          },
          { title: "Summary", content: summary },
        ],
      }).catch((err) => {
        console.error("[claim decision] supplier rejected email failed:", err)
      })
    }
  }

  // ---- Admin copy (action reminder for approved only) -----------------
  if (claim.status === "approved" && adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `Action: bump Bill freight - ${claim.orders.order_number}`,
      heading: "Variance Approved - Bill Adjustment Required",
      preheader: `Approved variance on ${claim.orders.order_number}: bill freight at AUD ${approved.toFixed(2)} instead of AUD ${quoted.toFixed(2)}.`,
      sections: [
        {
          content: `<p>You approved a freight variance claim. When you convert the Xero Purchase Order to a Bill (<em>Mark as billed</em> → review draft Bill), edit the freight line on the Bill from AUD ${quoted.toFixed(2)} to <strong>AUD ${approved.toFixed(2)}</strong> before approving the Bill.</p>
            <p>The PO stays as-is - only the Bill is adjusted.</p>`,
        },
        { title: "Summary", content: summary },
      ],
      ctaButton: {
        text: "Open Reconciliation",
        url: `${APP_URL}/admin/supplier-fulfillment/reconciliation`,
      },
    }).catch((err) => {
      console.error("[claim decision] admin approved email failed:", err)
    })
  }
}

export async function sendVarianceFlagEmails(
  args: SendVarianceFlagArgs,
): Promise<void> {
  const { supabase, orderId, quotedFreight, recalculatedFreight, delta, threshold } =
    args
  const adminEmail = await getAdminEmail()
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, user_id")
    .eq("id", orderId)
    .single()
  if (!order) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_name, email")
    .eq("id", order.user_id)
    .single()

  const summary = `<table width="100%">
      ${fmt("Order", order.order_number)}
      ${fmt("Quoted Freight", `AUD ${quotedFreight.toFixed(2)}`)}
      ${fmt("Recalculated", `AUD ${recalculatedFreight.toFixed(2)}`)}
      ${fmt("Delta", `AUD ${delta.toFixed(2)}`)}
      ${fmt("Threshold", `AUD ${threshold.toFixed(2)}`)}
    </table>`

  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `Freight variance flagged - ${order.order_number}`,
      heading: "Freight Variance Flagged",
      preheader: `Order ${order.order_number} dispatch freight differs by AUD ${delta.toFixed(2)}.`,
      sections: [
        { title: "Variance", content: summary },
        {
          content: `<p>Recalculated freight at supplier dispatch differs from the indicative quote by more than the configured threshold. Review the order and notify the buyer if appropriate.</p>`,
        },
      ],
      ctaButton: {
        text: "Open in Admin",
        url: `${APP_URL}/admin/orders/${order.id}`,
      },
    })
  }

  if (profile?.email) {
    await sendEmail({
      to: profile.email,
      subject: `Order ${order.order_number} - Freight Update`,
      heading: "Freight Update",
      preheader: `The supplier confirmed dispatch and the freight cost has changed.`,
      sections: [
        {
          content: `<p>Hi ${profile.contact_name ?? "there"},</p>
            <p>The supplier has confirmed dispatch for order <strong>${order.order_number}</strong>. The recalculated freight differs from the original quote by AUD ${delta.toFixed(
              2,
            )}. Our team will reach out shortly with details before the truck leaves the depot.</p>`,
        },
        { title: "Summary", content: summary },
      ],
      ctaButton: {
        text: "View Order",
        url: `${APP_URL}/dashboard/orders?order=${order.id}`,
      },
    })
  }
}
