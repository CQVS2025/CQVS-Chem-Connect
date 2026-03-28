import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// POST /api/upload-logo - upload a company logo (authenticated users)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, WebP, SVG" },
        { status: 400 },
      )
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Max 2MB." },
        { status: 400 },
      )
    }

    const ext = file.name.split(".").pop()
    const fileName = `${user.id}.${ext}`
    const filePath = `logos/${fileName}`

    // Upload (upsert to replace existing logo)
    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("company-logos").getPublicUrl(filePath)

    // Add cache-buster to URL so browser shows updated logo
    const url = `${publicUrl}?t=${Date.now()}`

    // Update profile with logo URL
    await supabase
      .from("profiles")
      .update({ company_logo_url: url })
      .eq("id", user.id)

    return NextResponse.json({ url }, { status: 201 })
  } catch (err) {
    console.error("POST /api/upload-logo error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
