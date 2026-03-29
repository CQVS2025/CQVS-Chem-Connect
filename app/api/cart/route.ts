import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET /api/cart - return user's cart items with product data
export async function GET() {
  try {
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

    const { data, error } = await supabase
      .from("cart_items")
      .select(
        `
        id,
        product_id,
        quantity,
        packaging_size,
        created_at,
        updated_at,
        products (
          id,
          name,
          slug,
          price,
          unit,
          image_url,
          in_stock,
          stock_qty,
          shipping_fee
        )
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform: Supabase returns "products" (relation name) but client expects "product"
    const items = (data ?? []).map((item: Record<string, unknown>) => {
      const { products: productData, ...rest } = item
      return { ...rest, product: productData }
    })

    return NextResponse.json(items)
  } catch (err) {
    console.error("GET /api/cart error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// POST /api/cart - add item to cart (upsert on conflict)
export async function POST(request: NextRequest) {
  try {
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
    const { product_id, quantity, packaging_size } = body

    if (!product_id || !quantity || !packaging_size) {
      return NextResponse.json(
        { error: "product_id, quantity, and packaging_size are required" },
        { status: 400 },
      )
    }

    // Check if item already exists in cart with same product and packaging size
    const { data: existing, error: findError } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", product_id)
      .eq("packaging_size", packaging_size)
      .maybeSingle()

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    if (existing) {
      // Update quantity on existing item
      const { data, error } = await supabase
        .from("cart_items")
        .update({
          quantity: existing.quantity + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
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
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json(data)
    }

    // Insert new cart item
    const { data, error } = await supabase
      .from("cart_items")
      .insert({
        user_id: user.id,
        product_id,
        quantity,
        packaging_size,
      })
      .select(
        `
        id,
        product_id,
        quantity,
        packaging_size,
        created_at,
        updated_at,
        products (
          id,
          name,
          slug,
          price,
          unit,
          image_url,
          in_stock,
          stock_qty,
          shipping_fee
        )
      `,
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("POST /api/cart error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
