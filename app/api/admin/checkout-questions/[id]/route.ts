import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params
  const body = await request.json()

  const { data, error } = await supabase
    .from("product_checkout_questions")
    .update(body)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const { id } = await ctx.params

  const { error } = await supabase
    .from("product_checkout_questions")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
