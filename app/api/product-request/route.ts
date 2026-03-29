import { NextRequest, NextResponse } from "next/server"
import { sendEmail, isEmailEnabled, getAdminEmail } from "@/lib/email/send"

export async function POST(request: NextRequest) {
  try {
    const { request: productRequest } = await request.json()

    if (!productRequest || typeof productRequest !== "string" || !productRequest.trim()) {
      return NextResponse.json({ error: "Request is required" }, { status: 400 })
    }

    // Check if admin email notifications are enabled
    const enabled = await isEmailEnabled()
    const adminEmail = await getAdminEmail()

    if (!enabled || !adminEmail) {
      // Still accept the request, just don't send email
      return NextResponse.json({ success: true })
    }

    await sendEmail({
      to: adminEmail,
      subject: "New Product Request from Chem Connect",
      heading: "Product Request",
      preheader: `Someone is looking for: ${productRequest.trim().slice(0, 50)}`,
      sections: [
        {
          content: `<p style="margin: 0 0 16px 0;">A visitor on the Chem Connect website submitted a product request.</p>`,
        },
        {
          title: "Requested Product",
          content: `<p style="margin: 0; font-size: 16px; color: #4ADE80; font-weight: 600;">${productRequest.trim()}</p>`,
        },
      ],
      footerNote:
        "This request was submitted from the landing page. Consider adding this product to the marketplace if there is demand.",
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("POST /api/product-request error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
