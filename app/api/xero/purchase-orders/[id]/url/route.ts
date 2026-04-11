import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/xero/purchase-orders/{id}/url
// Returns the deep link URL to view the purchase order in Xero (admin only).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  // Xero deep link to view/edit a purchase order
  const url = `https://go.xero.com/app/purchase-orders/edit/${id}`
  return NextResponse.json({ url })
}
