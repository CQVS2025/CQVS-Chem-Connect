import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/xero/invoices/{id}/url
// Returns the deep link URL to view the invoice in Xero (admin only).
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

  // Xero deep link to view/edit an invoice
  const url = `https://go.xero.com/app/invoicing/edit/${id}`
  return NextResponse.json({ url })
}
