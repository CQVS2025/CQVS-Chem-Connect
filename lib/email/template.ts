export interface EmailTemplateOptions {
  subject: string
  heading: string
  preheader?: string
  sections: {
    title?: string
    content: string
  }[]
  ctaButton?: {
    text: string
    url: string
  }
  footerNote?: string
  /** Override the support email shown in the footer. If not provided, uses the default. */
  supportEmail?: string
}

const LOGO_URL =
  "https://fsjlulqlvxvfgkycdrrd.supabase.co/storage/v1/object/public/product-images/Logo/cqvs-logo.png"

const COLORS = {
  primary: "#4ADE80",
  darkBg: "#132A38",
  cardBg: "#173241",
  white: "#FFFFFF",
  lightGray: "#E5E7EB",
  mutedText: "#94A3B8",
  border: "#1E3A4C",
} as const

export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { heading, preheader, sections, ctaButton, footerNote } = options

  const sectionRows = sections
    .map((section) => {
      const titleHtml = section.title
        ? `<tr>
            <td style="padding: 0 0 12px 0;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: ${COLORS.primary}; font-family: Arial, Helvetica, sans-serif;">
                ${section.title}
              </h2>
            </td>
          </tr>`
        : ""

      return `
        <tr>
          <td style="padding: 0 0 24px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 8px;">
              <tr>
                <td style="padding: 20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                    ${titleHtml}
                    <tr>
                      <td style="font-size: 15px; line-height: 1.6; color: ${COLORS.lightGray}; font-family: Arial, Helvetica, sans-serif;">
                        ${section.content}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    })
    .join("\n")

  const ctaHtml = ctaButton
    ? `<tr>
        <td style="padding: 8px 0 24px 0;" align="center">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr>
              <td style="background-color: ${COLORS.primary}; border-radius: 6px;">
                <a href="${ctaButton.url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: ${COLORS.darkBg}; text-decoration: none; font-family: Arial, Helvetica, sans-serif;">
                  ${ctaButton.text}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ""

  const footerNoteHtml = footerNote
    ? `<tr>
        <td style="padding: 16px 0 0 0; font-size: 13px; color: ${COLORS.mutedText}; font-family: Arial, Helvetica, sans-serif; line-height: 1.5;">
          ${footerNote}
        </td>
      </tr>`
    : ""

  const preheaderHtml = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 0; line-height: 0; color: transparent;">
        ${preheader}
        ${"&zwnj;&nbsp;".repeat(30)}
      </div>`
    : ""

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0D1F2D; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none;">
  ${preheaderHtml}

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: #0D1F2D;">
    <tr>
      <td align="center" style="padding: 24px 16px;">

        <!-- Main container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background-color: ${COLORS.darkBg}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center; border-bottom: 2px solid ${COLORS.primary};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <img src="${LOGO_URL}" alt="Chem Connect" width="80" height="80" style="display: block; border: 0; outline: none; width: 80px; height: 80px; object-fit: contain;" />
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: ${COLORS.white}; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px;">
                      Chem Connect
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: ${COLORS.mutedText}; font-family: Arial, Helvetica, sans-serif; letter-spacing: 1px; text-transform: uppercase;">
                      by CQVS
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: ${COLORS.darkBg}; padding: 32px 40px 16px 40px;">

              <!-- Heading -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding: 0 0 24px 0;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.white}; font-family: Arial, Helvetica, sans-serif; line-height: 1.3;">
                      ${heading}
                    </h1>
                    <div style="margin-top: 12px; width: 48px; height: 3px; background-color: ${COLORS.primary}; border-radius: 2px;"></div>
                  </td>
                </tr>

                <!-- Sections -->
                ${sectionRows}

                <!-- CTA Button -->
                ${ctaHtml}
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.darkBg}; border-radius: 0 0 12px 12px; padding: 24px 40px 32px 40px; border-top: 1px solid ${COLORS.border};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                ${footerNoteHtml}
                <tr>
                  <td style="padding: 16px 0 0 0; font-size: 12px; color: ${COLORS.mutedText}; font-family: Arial, Helvetica, sans-serif; line-height: 1.5; text-align: center;">
                    Chem Connect by CQVS<br />
                    Premium Chemical Supply Solutions<br />
                    ${options.supportEmail ? `<a href="mailto:${options.supportEmail}" style="color: ${COLORS.primary}; text-decoration: none;">${options.supportEmail}</a> | ` : ""}<span style="color: ${COLORS.primary};">https://www.cqvs-chemconnect.com.au</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0 0 0; font-size: 11px; color: #64748B; font-family: Arial, Helvetica, sans-serif; line-height: 1.4; text-align: center;">
                    This is an automated message from Chem Connect.${options.supportEmail ? ` For support, email <a href="mailto:${options.supportEmail}" style="color: #64748B;">${options.supportEmail}</a>.` : " Please do not reply directly to this email."}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}
