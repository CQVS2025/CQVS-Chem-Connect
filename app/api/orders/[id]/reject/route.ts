import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send"

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
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Only allow rejecting orders that haven't been approved yet.
  // Once approved (status = "received"), Xero invoice + PO are already created
  // and can't be undone from here - use Xero directly to void/cancel.
  const allowedStatuses = ["pending_approval"]
  if (!allowedStatuses.includes(order.status)) {
    return NextResponse.json(
      { error: `Order status must be one of: ${allowedStatuses.join(", ")}` },
      { status: 400 },
    )
  }

  // Update order status to "rejected"
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "rejected" })
    .eq("id", id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Insert status history entry
  await supabase.from("order_status_history").insert({
    order_id: id,
    status: "rejected",
    note: "Purchase order rejected by admin",
  })

  // Fetch profile separately
  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_name, email")
    .eq("id", order.user_id)
    .single()

  const customerEmail = profile?.email || ""
  const customerName = profile?.contact_name || "Customer"

  if (customerEmail) {
    sendEmail({
      to: customerEmail,
      subject: `Order #${order.order_number} - Purchase Order Not Approved`,
      heading: "Purchase Order Not Approved",
      preheader: `Order #${order.order_number} could not be approved at this time.`,
      sections: [
        {
          content: `
            <p>Hi ${customerName},</p>
            <p>Your purchase order was not approved. Please contact us for more information.</p>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p>Our team is here to help. Please reach out so we can resolve any issues and assist you with your order.</p>
          `,
        },
      ],
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
