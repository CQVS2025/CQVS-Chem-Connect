import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { sendQuoteStatusUpdateEmail } from "@/lib/email/notifications"

// PATCH /api/quotes/[id] - admin update quote status/notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const body = await request.json()
    const { status, admin_notes } = body

    const updateData: Record<string, unknown> = {}

    if (status) updateData.status = status
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes

    const { data, error } = await supabase
      .from("quote_requests")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send status update email to customer (non-blocking)
    if (status && data) {
      sendQuoteStatusUpdateEmail(data.contact_email, {
        customerName: data.contact_name,
        productName: data.product_name,
        status,
        adminNotes: admin_notes,
      })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("PATCH /api/quotes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/quotes/[id] - admin-only
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const { error } = await supabase.from("quote_requests").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/quotes/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
