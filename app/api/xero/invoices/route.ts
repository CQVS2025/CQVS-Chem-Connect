import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createXeroInvoiceForOrder } from "@/lib/xero/sync"

// POST /api/xero/invoices - manually trigger invoice creation for an order
// Body: { order_id: string }
// Used for retries from the admin Xero page when the auto-create failed.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const orderId = body.order_id as string | undefined

  if (!orderId) {
    return NextResponse.json(
      { error: "order_id is required" },
      { status: 400 },
    )
  }

  const result = await createXeroInvoiceForOrder(orderId)

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Invoice creation failed - check the Xero connection and sync log.",
      },
      { status: 200 },
    )
  }

  return NextResponse.json({ ok: true, ...result })
}
