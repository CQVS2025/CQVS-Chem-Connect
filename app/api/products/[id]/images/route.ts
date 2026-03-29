import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET /api/products/[id]/images - list all images for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", id)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("GET /api/products/[id]/images error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/products/[id]/images - upload image(s) for a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const isCover = formData.get("is_cover") === "true"

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Migrate legacy image_url to product_images table if needed
    const { count: existingCount } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id)

    if (existingCount === 0) {
      const { data: product } = await supabase
        .from("products")
        .select("image_url")
        .eq("id", id)
        .single()

      if (product?.image_url) {
        await supabase.from("product_images").insert({
          product_id: id,
          image_url: product.image_url,
          is_cover: true,
          sort_order: 0,
        })
      }
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"]
    const uploaded: { id: string; image_url: string; is_cover: boolean }[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!allowedTypes.includes(file.type)) continue
      if (file.size > 5 * 1024 * 1024) continue

      const ext = file.name.split(".").pop()
      const fileName = `${crypto.randomUUID()}.${ext}`
      const filePath = `products/${id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) continue

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath)

      // If this is marked as cover, unset other covers first
      const shouldBeCover = isCover && i === 0

      if (shouldBeCover) {
        await supabase
          .from("product_images")
          .update({ is_cover: false })
          .eq("product_id", id)
      }

      // Get max sort order
      const { data: maxSort } = await supabase
        .from("product_images")
        .select("sort_order")
        .eq("product_id", id)
        .order("sort_order", { ascending: false })
        .limit(1)

      const nextSort = (maxSort?.[0]?.sort_order ?? -1) + 1

      const { data: imageRow, error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: id,
          image_url: publicUrl,
          is_cover: shouldBeCover,
          sort_order: nextSort,
        })
        .select()
        .single()

      if (!insertError && imageRow) {
        uploaded.push(imageRow)

        // Update product's main image_url if this is cover
        if (shouldBeCover) {
          await supabase
            .from("products")
            .update({ image_url: publicUrl })
            .eq("id", id)
        }
      }
    }

    return NextResponse.json(uploaded, { status: 201 })
  } catch (err) {
    console.error("POST /api/products/[id]/images error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/products/[id]/images - set cover image
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const { image_id } = await request.json()

    if (!image_id) {
      return NextResponse.json({ error: "image_id is required" }, { status: 400 })
    }

    // Unset all covers
    await supabase
      .from("product_images")
      .update({ is_cover: false })
      .eq("product_id", id)

    // Set new cover
    const { data: image } = await supabase
      .from("product_images")
      .update({ is_cover: true })
      .eq("id", image_id)
      .select()
      .single()

    if (image) {
      // Update product's main image_url
      await supabase
        .from("products")
        .update({ image_url: image.image_url })
        .eq("id", id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("PATCH /api/products/[id]/images error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/products/[id]/images - delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const { image_id } = await request.json()

    if (!image_id) {
      return NextResponse.json({ error: "image_id is required" }, { status: 400 })
    }

    // Get image to check if cover
    const { data: image } = await supabase
      .from("product_images")
      .select("*")
      .eq("id", image_id)
      .single()

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Delete from table
    await supabase
      .from("product_images")
      .delete()
      .eq("id", image_id)

    // If deleted image was cover, set next image as cover
    if (image.is_cover) {
      const { data: nextImage } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single()

      if (nextImage) {
        await supabase
          .from("product_images")
          .update({ is_cover: true })
          .eq("id", nextImage.id)

        await supabase
          .from("products")
          .update({ image_url: nextImage.image_url })
          .eq("id", id)
      } else {
        // No images left
        await supabase
          .from("products")
          .update({ image_url: null })
          .eq("id", id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/products/[id]/images error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
