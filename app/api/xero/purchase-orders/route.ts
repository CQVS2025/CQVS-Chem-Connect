import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createXeroPurchaseOrderForOrder } from "@/lib/xero/sync"

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { order_id } = await request.json()
  if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 })

  const result = await createXeroPurchaseOrderForOrder(order_id)
  if (!result) return NextResponse.json({ error: "Failed to create PO" }, { status: 422 })

  return NextResponse.json(result)
}
