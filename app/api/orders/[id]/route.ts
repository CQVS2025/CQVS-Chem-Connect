import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { sendOrderStatusUpdateEmail } from "@/lib/email/notifications"

// GET /api/orders/[id] - return single order with items and status history
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
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

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          product_id,
          product_name,
          product_image_url,
          quantity,
          unit,
          packaging_size,
          unit_price,
          total_price,
          shipping_fee
        ),
        order_status_history (
          id,
          status,
          note,
          created_at,
          created_by
        )
      `,
      )
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isAdmin = profile?.role === "admin"

    // Non-admin users can only view their own orders
    if (!isAdmin && order.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    // Transform to match Order type
    const { order_items, order_status_history, ...rest } = order as Record<string, unknown>
    return NextResponse.json({
      ...rest,
      items: order_items ?? [],
      status_history: order_status_history ?? [],
    })
  } catch (err) {
    console.error("GET /api/orders/[id] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// PATCH /api/orders/[id] - admin-only - update order status and tracking
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase, user } = await requireAdmin()
    if (adminError) return adminError

    const body = await request.json()
    const { status, tracking_number, note } = body

    // Build the update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status) {
      updateData.status = status
    }

    if (tracking_number !== undefined) {
      updateData.tracking_number = tracking_number
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Insert into order_status_history if status was changed
    if (status) {
      const { error: historyError } = await supabase
        .from("order_status_history")
        .insert({
          order_id: id,
          status,
          note: note || null,
          created_by: user!.id,
        })

      if (historyError) {
        console.error("Failed to insert status history:", historyError.message)
      }
    }

    // Send status update email to customer (non-blocking)
    if (status && order) {
      const { data: customerProfile } = await supabase
        .from("profiles")
        .select("contact_name, email")
        .eq("id", order.user_id)
        .single()

      if (customerProfile?.email) {
        sendOrderStatusUpdateEmail(customerProfile.email, {
          customerName: customerProfile.contact_name || "Customer",
          orderNumber: order.order_number,
          status,
          trackingNumber: tracking_number,
        })
      }
    }

    return NextResponse.json(order)
  } catch (err) {
    console.error("PATCH /api/orders/[id] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// DELETE /api/orders/[id] - admin-only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const { error } = await supabase.from("orders").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/orders/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
