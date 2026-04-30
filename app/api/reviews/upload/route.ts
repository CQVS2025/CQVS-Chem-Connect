import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { verifyTokenSignature } from "@/lib/reviews/tokens"

/**
 * POST /api/reviews/upload
 *
 * Body: multipart/form-data with `token` (the same magic-link token
 * from the submit page URL) and `file` (one image per call). The submit
 * page calls this up to 3 times before final review insert.
 *
 * Validation:
 *   - Token signature OK (just signature — full DB validation happens at
 *     submit time; here we only need to know the upload is tied to a
 *     plausibly-real token, not abusable as a generic image host).
 *   - File type: image/jpeg, image/png, image/webp only (no SVG, no GIF).
 *   - File size: <= 5 MB.
 *   - Storage path: review-photos/<token_id>/<uuid>.<ext>. The token_id
 *     scopes uploads so a leaked token can't pollute another order's path.
 *
 * Photos are inserted into review_photos at submit time, NOT here.
 * This endpoint just lays the file in storage and returns the public URL +
 * storage path so the submit form can carry them through.
 */

export const maxDuration = 30

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get("token")
    const file = formData.get("file")

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const decoded = verifyTokenSignature(token)
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. JPEG, PNG, or WebP only." },
        { status: 400 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max 5MB per photo." },
        { status: 400 },
      )
    }

    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"
    const objectPath = `${decoded.tokenId}/${randomUUID()}.${ext}`

    const supabase = createServiceRoleClient()
    const { error: uploadErr } = await supabase.storage
      .from("review-photos")
      .upload(objectPath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadErr) {
      console.error("review-photos upload failed:", uploadErr)
      return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("review-photos").getPublicUrl(objectPath)

    return NextResponse.json(
      { storagePath: objectPath, publicUrl },
      { status: 201 },
    )
  } catch (err) {
    console.error("POST /api/reviews/upload error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// Next.js App Router routes default to a small body limit. The multipart
// upload above is read via formData() which streams; explicit config is
// only needed if a custom parser fails. Default is sufficient up to ~10 MB
// in modern Next versions, well above our 5 MB ceiling.
