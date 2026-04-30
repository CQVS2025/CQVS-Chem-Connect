/**
 * Email-template builders for the post-delivery review-request flow.
 *
 * Two builders, mirroring the two cron-driven kinds:
 *   - buildInitialReviewEmail()  - fires at +7 days, friendly first ask
 *   - buildReminderReviewEmail() - fires at +14 days, single nudge
 *
 * Both return a structured object that lib/email/send.ts consumes; the
 * shared template wrapper handles HTML rendering, footer, and Mailgun
 * delivery. No HTML lives in this file - keeps it consistent with other
 * transactional emails.
 */

interface BuildInput {
  /** Friendly form, e.g. "Marcus" or "Acme Concreting". Null = generic salutation. */
  recipientName: string | null
  productName: string
  orderNumber: string
  /** Pre-built magic-link URL. Already token-encoded. */
  submitUrl: string
}

export interface ReviewEmailContent {
  subject: string
  heading: string
  preheader: string
  sections: { title?: string; content: string }[]
  ctaText: string
  footerNote: string
}

function greeting(recipientName: string | null): string {
  return recipientName ? `Hi ${recipientName},` : "Hi there,"
}

export function buildInitialReviewEmail(input: BuildInput): ReviewEmailContent {
  const subject = `How was the ${input.productName}?`
  return {
    subject,
    heading: "How was your delivery?",
    preheader: `Two-minute review for order ${input.orderNumber}.`,
    sections: [
      {
        content: `<p>${greeting(input.recipientName)}</p>`,
      },
      {
        content: `<p>Your <strong>${input.productName}</strong> from order <strong>${input.orderNumber}</strong> was delivered about a week ago - long enough that you've probably had a chance to put it to work.</p>`,
      },
      {
        content: `<p>Would you mind leaving a quick review? It takes about two minutes, no login needed, and helps other buyers in the same line of work decide whether the product fits.</p>`,
      },
      {
        content: `<p>Star rating, a short headline, a few sentences - that's it. You can also attach up to three photos if you'd like to show the product in action.</p>`,
      },
    ],
    ctaText: "Leave a review",
    footerNote:
      "If you'd rather not, no problem - you'll get one short reminder in a week and then we'll stop. We never share your details with third parties.",
  }
}

export function buildReminderReviewEmail(
  input: BuildInput,
): ReviewEmailContent {
  const subject = `Quick review for the ${input.productName}?`
  return {
    subject,
    heading: "One quick review?",
    preheader: `Last reminder for order ${input.orderNumber}.`,
    sections: [
      {
        content: `<p>${greeting(input.recipientName)}</p>`,
      },
      {
        content: `<p>Just a single follow-up on the <strong>${input.productName}</strong> from order <strong>${input.orderNumber}</strong>. If you've got two minutes, a short review would genuinely help other buyers - especially the negative or mixed ones, those carry the most weight.</p>`,
      },
      {
        content: `<p>This is the last email you'll get about this order. If now's not the right time, no follow-ups, no reminders - we'll let it go.</p>`,
      },
    ],
    ctaText: "Leave a review",
    footerNote:
      "This is the only follow-up we send. After this, no further reminders for this order.",
  }
}
