import { createClient } from "@supabase/supabase-js"
import { sendEmail, isEmailEnabled, getAdminEmail } from "@/lib/email/send"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env vars")
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function parseStampedOrders(notes: string | null): Set<string> {
  if (!notes) return new Set()
  const match = notes.match(/\[orders:([^\]]*)\]/)
  if (!match) return new Set()
  return new Set(match[1].split(",").filter(Boolean))
}

function serializeStampedOrders(orders: Set<string>): string {
  return `[orders:${[...orders].join(",")}]`
}

const STAMPS_PER_FREE_IBC = 10

/**
 * Auto-add stamps for IBC (1000L) items in an order.
 * Sends milestone emails when customer hits 10 stamps.
 */
export async function autoAddStampsForOrder(
  orderId: string,
  userId: string
): Promise<{ stampsAdded: number }> {
  const supabase = getServiceClient()

  // Fetch order items
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_name, quantity, packaging_size")
    .eq("order_id", orderId)

  if (itemsError || !orderItems || orderItems.length === 0) {
    return { stampsAdded: 0 }
  }

  // Count IBC items
  let newStamps = 0
  const ibcItems: string[] = []

  for (const item of orderItems) {
    const pkg = (item.packaging_size || "").toLowerCase()
    if (pkg.includes("1000") || pkg.includes("ibc")) {
      newStamps += item.quantity
      ibcItems.push(`${item.quantity}x ${item.product_name}`)
    }
  }

  if (newStamps === 0) {
    return { stampsAdded: 0 }
  }

  // Get existing stamp record for this user
  const { data: existing } = await supabase
    .from("stamp_records")
    .select("id, stamps_earned, notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousTotal = existing?.stamps_earned ?? 0
  let updatedTotal = previousTotal

  if (existing) {
    const stampedOrders = parseStampedOrders(existing.notes)
    if (stampedOrders.has(orderId)) {
      return { stampsAdded: 0 }
    }

    stampedOrders.add(orderId)
    updatedTotal = existing.stamps_earned + newStamps

    const readableParts = (existing.notes || "")
      .replace(/\[orders:[^\]]*\]/, "")
      .trim()
    const newNote = readableParts
      ? `${readableParts}, ${ibcItems.join(", ")}`
      : ibcItems.join(", ")

    await supabase
      .from("stamp_records")
      .update({
        stamps_earned: updatedTotal,
        notes: `${newNote} ${serializeStampedOrders(stampedOrders)}`,
      })
      .eq("id", existing.id)
  } else {
    const stampedOrders = new Set([orderId])
    updatedTotal = newStamps

    await supabase
      .from("stamp_records")
      .insert({
        user_id: userId,
        order_id: orderId,
        stamps_earned: updatedTotal,
        notes: `${ibcItems.join(", ")} ${serializeStampedOrders(stampedOrders)}`,
      })
  }

  // Check if customer crossed a 10-stamp milestone
  const previousFreeIBCs = Math.floor(previousTotal / STAMPS_PER_FREE_IBC)
  const currentFreeIBCs = Math.floor(updatedTotal / STAMPS_PER_FREE_IBC)

  if (currentFreeIBCs > previousFreeIBCs) {
    // Milestone hit! Send emails
    await sendStampMilestoneEmails(supabase, userId, updatedTotal, currentFreeIBCs)
  }

  return { stampsAdded: newStamps }
}

async function sendStampMilestoneEmails(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  totalStamps: number,
  freeIBCsEarned: number
) {
  const emailEnabled = await isEmailEnabled()
  if (!emailEnabled) return

  // Get customer info
  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_name, email, company_name")
    .eq("id", userId)
    .maybeSingle()

  if (!profile?.email) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const customerName = profile.contact_name || "Customer"

  // Email to customer
  await sendEmail({
    to: profile.email,
    subject: "You've Earned a Free IBC! - Chem Connect",
    heading: "Free IBC Unlocked!",
    preheader: `You've collected ${totalStamps} stamps and earned a free IBC of Truck Wash Standard, Truck Wash Premium, or Eco Wash.`,
    sections: [
      {
        title: "Congratulations!",
        content: `
          <p>Hi ${customerName},</p>
          <p>You've just hit <strong>${totalStamps} loyalty stamps</strong>! That means you've earned <strong>${freeIBCsEarned} free IBC${freeIBCsEarned > 1 ? "s" : ""}</strong> in total.</p>
          <p>You can choose one of the following products for your free 1000L IBC:</p>
          <ul style="padding-left: 20px; margin: 10px 0;">
            <li><strong>Truck Wash Standard</strong></li>
            <li><strong>Truck Wash Premium</strong></li>
            <li><strong>Eco Wash</strong></li>
          </ul>
        `,
      },
      {
        title: "What Happens Next",
        content: `
          <p>Our team at Chem Connect will be reaching out to you shortly to arrange your free IBC delivery. If for any reason you don't hear from us within a few business days, please don't hesitate to get in touch.</p>
          <p>You can check your stamp progress anytime on your <a href="${appUrl}/dashboard/rewards" style="color: #52c77d; text-decoration: underline;">rewards dashboard</a>.</p>
        `,
      },
    ],
    ctaButton: {
      text: "View Your Rewards",
      url: `${appUrl}/dashboard/rewards`,
    },
    footerNote: "You're receiving this because you hit a loyalty stamp milestone on Chem Connect.",
  }).catch(() => {})

  // Email to admin
  const adminEmail = await getAdminEmail()
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `Stamp Milestone - ${customerName} earned a free IBC`,
      heading: "Stamp Card Milestone",
      preheader: `${customerName} has collected ${totalStamps} stamps and earned a free IBC.`,
      sections: [
        {
          title: "Customer Details",
          content: `
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${profile.email}</p>
            <p><strong>Company:</strong> ${profile.company_name || "N/A"}</p>
            <p><strong>Total stamps:</strong> ${totalStamps}</p>
            <p><strong>Free IBCs earned:</strong> ${freeIBCsEarned}</p>
            <p>Please arrange delivery of a free IBC (TW Standard, TW Premium, or Eco Wash) to this customer.</p>
          `,
        },
      ],
      ctaButton: {
        text: "View Stamps",
        url: `${appUrl}/admin/rewards`,
      },
      footerNote: "Auto-generated when a customer reaches a stamp card milestone.",
    }).catch(() => {})
  }
}
