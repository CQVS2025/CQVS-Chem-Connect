// Admin CRUD for product_checkout_questions (component 6).

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const productId = request.nextUrl.searchParams.get("product_id")
  let q = supabase
    .from("product_checkout_questions")
    .select("*")
    .order("display_order", { ascending: true })

  if (productId) q = q.eq("product_id", productId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()
  if (!body.product_id || !body.question_key || !body.label || !body.question_type) {
    return NextResponse.json(
      { error: "product_id, question_key, label, question_type are required" },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("product_checkout_questions")
    .insert({
      product_id: body.product_id,
      packaging_size_id: body.packaging_size_id ?? null,
      question_key: body.question_key,
      label: body.label,
      help_text: body.help_text ?? null,
      question_type: body.question_type,
      options: body.options ?? null,
      required: body.required ?? false,
      warning_when_value: body.warning_when_value ?? null,
      warning_copy: body.warning_copy ?? null,
      display_order: body.display_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
