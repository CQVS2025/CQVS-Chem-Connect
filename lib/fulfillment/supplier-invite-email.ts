// Custom branded supplier-invite email.
//
// Sent when admin creates a brand-new supplier account via
// /admin/supplier-fulfillment/warehouses/[id]. The email contains a
// time-limited link to set their password, the warehouse they've been
// assigned to, and a quick orientation to the supplier dashboard.
//
// Uses the project's Mailgun helper (lib/email/send.ts) — no Supabase
// built-in templates.

import { sendEmail } from "@/lib/email/send"

export interface SendSupplierInviteArgs {
  to: string
  contactName: string | null
  warehouseName: string
  setPasswordLink: string
  receivesPoEmails: boolean
  canUpdateOrders: boolean
}

export async function sendSupplierInviteEmail(
  args: SendSupplierInviteArgs,
): Promise<boolean> {
  const {
    to,
    contactName,
    warehouseName,
    setPasswordLink,
    receivesPoEmails,
    canUpdateOrders,
  } = args

  const greeting = contactName ? `Hi ${contactName},` : "Hi,"

  const accessLines: string[] = [
    `<li>You can sign in to the supplier dashboard once your password is set.</li>`,
    `<li>You'll see only the orders for <strong>${warehouseName}</strong>.</li>`,
  ]
  if (receivesPoEmails) {
    accessLines.push(
      `<li>You'll receive a purchase-order email each time a buyer places an order.</li>`,
    )
  }
  if (canUpdateOrders) {
    accessLines.push(
      `<li>You can update dispatch dates, ETAs, dispatch notes and tracking links — buyers are notified automatically when you do.</li>`,
    )
  } else {
    accessLines.push(
      `<li>Your access is read-only — only colleagues with edit permission on this warehouse can update dispatch fields.</li>`,
    )
  }

  return sendEmail({
    to,
    subject: `You're invited to Chem Connect (${warehouseName})`,
    heading: "Welcome to Chem Connect",
    preheader: `Set your password to access the supplier dashboard for ${warehouseName}.`,
    sections: [
      {
        content: `<p style="margin: 0 0 12px 0;">${greeting}</p>
          <p style="margin: 0 0 12px 0;">Chem Connect has set up a supplier account for you against <strong>${warehouseName}</strong>. Click the button below to set your password and access the supplier dashboard.</p>
          <p style="margin: 0 0 12px 0; color: #94A3B8; font-size: 12px;">For security, this link expires in 24 hours. If it lapses, ask your Chem Connect admin to resend it.</p>`,
      },
      {
        title: "What you'll be able to do",
        content: `<ul style="padding-left: 18px; margin: 0;">${accessLines.join("\n")}</ul>`,
      },
    ],
    ctaButton: {
      text: "Set your password",
      url: setPasswordLink,
    },
    footerNote:
      "If you weren't expecting this invitation, please ignore this email. The link won't work without an active Chem Connect account on our end.",
  })
}
