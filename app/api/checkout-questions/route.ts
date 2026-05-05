// GET /api/checkout-questions?cart=<json>
// Returns all active site-access questions for the products+packaging-sizes
// in the cart. Frontend renders these on the checkout page (component 6).
//
// Cart format: ?cart=[{"product_id":"…","packaging_size_id":"…"},…]

import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const cartParam = request.nextUrl.searchParams.get("cart")
  if (!cartParam) {
    return NextResponse.json({ questions: [] })
  }

  let parsed: Array<{ product_id: string; packaging_size_id?: string | null }>
  try {
    parsed = JSON.parse(cartParam)
    if (!Array.isArray(parsed)) throw new Error("cart must be array")
  } catch {
    return NextResponse.json(
      { error: "cart must be JSON array" },
      { status: 400 },
    )
  }

  const productIds = [...new Set(parsed.map((p) => p.product_id))]
  if (productIds.length === 0) return NextResponse.json({ questions: [] })

  const { data: questions, error } = await supabase
    .from("product_checkout_questions")
    .select(
      "id, product_id, packaging_size_id, question_key, label, help_text, question_type, options, required, warning_when_value, warning_copy, display_order",
    )
    .in("product_id", productIds)
    .eq("is_active", true)
    .order("display_order", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter so per-size questions only fire for matching cart lines.
  const filtered = (questions ?? []).filter((q) => {
    if (q.packaging_size_id === null) return true
    return parsed.some(
      (line) =>
        line.product_id === q.product_id &&
        line.packaging_size_id === q.packaging_size_id,
    )
  })

  return NextResponse.json({ questions: filtered })
}
