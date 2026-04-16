import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// PATCH /api/cart/[id] - update quantity for a cart item
export async function PATCH(
  request: NextRequest,
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

    const body = await request.json()
    const { quantity } = body

    if (typeof quantity !== "number" || quantity < 1) {
      return NextResponse.json(
        { error: "quantity must be a positive number" },
        { status: 400 },
      )
    }

    // Enforce MOQ — look up the cart item's packaging_size_id then check MOQ
    const { data: cartItem } = await supabase
      .from("cart_items")
      .select("product_id, packaging_size_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (cartItem?.packaging_size_id) {
      const { data: pricingRow } = await supabase
        .from("product_packaging_prices")
        .select("minimum_order_quantity")
        .eq("product_id", cartItem.product_id)
        .eq("packaging_size_id", cartItem.packaging_size_id)
        .maybeSingle()

      const moq = pricingRow?.minimum_order_quantity ?? 1
      if (quantity < moq) {
        return NextResponse.json(
          { error: `Minimum order quantity for this size is ${moq}.`, moq },
          { status: 400 },
        )
      }
    }

    const { data, error } = await supabase
      .from("cart_items")
      .update({
        quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select(
        `
        id,
        product_id,
        quantity,
        packaging_size,
        created_at,
        updated_at,
        products (
          name,
          price,
          unit,
          image_url,
          in_stock
        )
      `,
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("PATCH /api/cart/[id] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// DELETE /api/cart/[id] - remove a cart item
export async function DELETE(
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

    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/cart/[id] error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
