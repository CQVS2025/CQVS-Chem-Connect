/**
 * Branded HTML wrapper for marketing campaigns sent via Compose mode.
 *
 * Matches the visual identity of the transactional-email template in
 * lib/email/template.ts (dark #132A38 background, teal #4ADE80 accent,
 * CQVS logo) so marketing emails land in the inbox feeling like the same
 * product as receipts/notifications.
 *
 * The `bodyHtml` argument is the Quill editor's HTML output, already
 * sanitised by DOMPurify on the client. We still wrap it in a presentation
 * `<td>` with our own typography styles, but we don't re-sanitise - Quill
 * only produces safe tags (p, br, strong, em, a, ul, ol, li, h1-h3) and
 * the client enforces that boundary.
 */

export interface MarketingEmailTemplateOptions {
  /** Plain-text heading rendered at the top of the card. Usually the subject. */
  heading: string
  /** Inbox preview text. Hidden in the rendered email body. */
  preheader?: string
  /** User-authored HTML from the Quill composer. */
  bodyHtml: string
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
  page: "#0D1F2D",
} as const

export function buildMarketingEmailHtml(
  options: MarketingEmailTemplateOptions,
): string {
  const { heading, preheader, bodyHtml } = options

  const preheaderHtml = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 0; line-height: 0; color: transparent;">
        ${escapeHtml(preheader)}
        ${"&zwnj;&nbsp;".repeat(30)}
      </div>`
    : ""

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Keep user-authored lists/links readable in dark mode without letting
       Quill's default classes leak unexpected behaviour. */
    .cc-body a { color: ${COLORS.primary}; text-decoration: underline; }
    .cc-body p { margin: 0 0 12px 0; }
    .cc-body p:last-child { margin-bottom: 0; }
    .cc-body ul, .cc-body ol { margin: 0 0 12px 0; padding-left: 22px; }
    .cc-body li { margin-bottom: 4px; }
    .cc-body h1, .cc-body h2, .cc-body h3 { color: ${COLORS.primary}; margin: 16px 0 8px 0; }
    .cc-body blockquote { border-left: 3px solid ${COLORS.primary}; padding-left: 12px; margin: 12px 0; color: ${COLORS.mutedText}; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.page}; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: none;">
  ${preheaderHtml}

  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: ${COLORS.page};">
    <tr>
      <td align="center" style="padding: 24px 16px;">

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
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: ${COLORS.white}; font-family: Arial, Helvetica, sans-serif; letter-spacing: 0.5px;">Chem Connect</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: ${COLORS.mutedText}; font-family: Arial, Helvetica, sans-serif; letter-spacing: 1px; text-transform: uppercase;">by CQVS</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: ${COLORS.darkBg}; padding: 32px 40px 16px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding: 0 0 24px 0;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: ${COLORS.white}; font-family: Arial, Helvetica, sans-serif; line-height: 1.3;">
                      ${escapeHtml(heading)}
                    </h1>
                    <div style="margin-top: 12px; width: 48px; height: 3px; background-color: ${COLORS.primary}; border-radius: 2px;"></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 24px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 8px;">
                      <tr>
                        <td class="cc-body" style="padding: 24px; font-size: 15px; line-height: 1.6; color: ${COLORS.lightGray}; font-family: Arial, Helvetica, sans-serif;">
                          ${bodyHtml}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${COLORS.darkBg}; border-radius: 0 0 12px 12px; padding: 24px 40px 32px 40px; border-top: 1px solid ${COLORS.border};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding: 0; font-size: 12px; color: ${COLORS.mutedText}; font-family: Arial, Helvetica, sans-serif; line-height: 1.5; text-align: center;">
                    Chem Connect by CQVS<br />
                    Premium Chemical Supply Solutions<br />
                    <span style="color: ${COLORS.primary};">https://www.cqvs-chemconnect.com.au</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 0 0 0; font-size: 11px; color: #64748B; font-family: Arial, Helvetica, sans-serif; line-height: 1.4; text-align: center;">
                    You are receiving this email because you are a Chem Connect contact. GoHighLevel adds an unsubscribe link automatically.
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

/**
 * Minimal HTML wrapper for "plain mode" campaigns.
 *
 * Goal: render the user's body content as a normal-looking email - no CQVS
 * header, no navy colors, no footer card, no centered "card" container.
 * Just left-aligned content with a sensible system font, the way a real
 * personal email reads in an inbox.
 *
 * Why we still wrap at all: GHL's send pipeline and most inbox clients
 * render bare fragments inconsistently (Outlook in particular default-
 * centers tables and can pick up unexpected alignment). A minimal
 * `<html><body>` shell with explicit `text-align: left` and Quill's
 * `ql-align-*` classes neutralised gives predictable left-aligned
 * rendering everywhere.
 *
 * Compliance footer + unsubscribe link are injected by GHL itself on the
 * outbound side, so we don't add anything here.
 */
export function buildPlainEmailHtml(options: {
  bodyHtml: string
  preheader?: string
}): string {
  const { bodyHtml, preheader } = options
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:0;line-height:0;color:transparent;">${escapeHtml(preheader)}${"&zwnj;&nbsp;".repeat(30)}</div>`
    : ""

  // GHL re-wraps our HTML before sending (their outer shell adds the
  // unsubscribe footer + branding container). Anything in <style> blocks
  // tends to get stripped, and inherited `text-align: center` from their
  // outer table cascades into our <p>/<h*>/<li> tags unless those tags
  // carry their own inline style. So: walk the body HTML and inject
  // inline `text-align:left` (plus normalised margins/padding) onto each
  // block element. This is the only thing that reliably survives.
  const inlinedBody = inlinePlainBlockStyles(bodyHtml)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
/* Defence in depth — these rules are the first thing that defeats any
   centered outer wrapper (GHL's send shell, Outlook's default-centered
   tables, etc.). They use !important so even an !important rule injected
   by a downstream wrapper can't beat them. */
html, body { margin:0 !important; padding:0 !important; text-align:left !important; }
body, body * { text-align:left !important; }
body table, body td { text-align:left !important; }
.cc-plain-wrap, .cc-plain-wrap * { text-align:left !important; }
</style>
</head>
<body style="margin:0 !important;padding:0 !important;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;text-align:left !important;">
${preheaderHtml}
<div class="cc-plain-wrap" style="text-align:left !important;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;" align="left">
${inlinedBody}
</div>
</body>
</html>`
}

/**
 * Admin UI only: wraps everything inside `<body>` in a padded div so the
 * live iframe preview does not sit flush against the iframe chrome. Outbound
 * sends and stored `body_html` must use the unwrapped document from
 * {@link buildPlainEmailHtml} — never persist this output.
 */
export function wrapPlainEmailHtmlForAdminPreview(html: string): string {
  if (!html.trim() || !/<body\b/i.test(html)) return html
  const inset =
    '<div style="padding:14px 16px 16px 16px;box-sizing:border-box;">'
  const opened = html.replace(/<body(\b[^>]*)>/i, `<body$1>${inset}`)
  const closeIdx = opened.lastIndexOf("</body>")
  if (closeIdx === -1) return html
  return `${opened.slice(0, closeIdx)}</div>${opened.slice(closeIdx)}`
}

/**
 * Add inline `text-align:left` (and sane margins) to every block tag in the
 * body HTML so the alignment can't be overridden by an outer wrapper that
 * GHL or the inbox client adds. We also strip Quill's `ql-align-*` classes
 * since their effect can't be relied on once the <style> block is gone.
 */
function inlinePlainBlockStyles(html: string): string {
  if (!html) return ""

  // 1. Drop Quill alignment classes — they only work with their stylesheet.
  let out = html.replace(/\sclass="ql-align-(?:center|right|justify)"/g, "")

  // 2. Inject text-align:left + margin into the open tag of each common
  //    block element. Match the opening tag with optional attributes so we
  //    can append a style attribute (or merge into an existing one).
  const styleByTag: Record<string, string> = {
    p:          "text-align:left !important;margin:0 0 12px 0;",
    h1:         "text-align:left !important;margin:0 0 12px 0;",
    h2:         "text-align:left !important;margin:0 0 12px 0;",
    h3:         "text-align:left !important;margin:0 0 12px 0;",
    ul:         "text-align:left !important;margin:0 0 12px 0;padding-left:22px;",
    ol:         "text-align:left !important;margin:0 0 12px 0;padding-left:22px;",
    li:         "text-align:left !important;margin:0 0 4px 0;",
    blockquote: "text-align:left !important;margin:0 0 12px 0;",
    div:        "text-align:left !important;",
  }

  for (const [tag, declarations] of Object.entries(styleByTag)) {
    const openRe = new RegExp(`<${tag}\\b([^>]*)>`, "gi")
    out = out.replace(openRe, (_match, attrs: string) => {
      const styleMatch = attrs.match(/\sstyle="([^"]*)"/i)
      if (styleMatch) {
        // Idempotent — skip if our override declarations are already present.
        if (styleMatch[1].includes("text-align:left !important")) {
          return `<${tag}${attrs}>`
        }
        const merged = `${declarations}${styleMatch[1]}`
        const newAttrs = attrs.replace(styleMatch[0], ` style="${merged}"`)
        return `<${tag}${newAttrs}>`
      }
      return `<${tag}${attrs} style="${declarations}">`
    })
  }

  return out
}

/**
 * Patch a stored plain-mode email HTML doc so it renders left-aligned
 * regardless of what wrapper it was saved with. Two complementary fixes:
 *   1. Insert a `<style>` block with !important left-align rules just
 *      before `</head>` (works in any browser preview / inbox client that
 *      doesn't strip <style>).
 *   2. Inline `text-align:left !important` onto every block element in the
 *      body (works even when <style> blocks are stripped by an outer
 *      wrapper like GHL's send shell).
 *
 * Idempotent — safe to call on HTML that already includes the override.
 */
export function forceLeftAlignDocument(html: string): string {
  if (!html) return ""

  let out = html

  // 1. Inject override stylesheet if not already present.
  const overrideMarker = "/* cc-plain-leftalign-override */"
  if (!out.includes(overrideMarker)) {
    const overrideStyle = `<style>${overrideMarker}
html, body { margin:0 !important; padding:0 !important; text-align:left !important; }
body, body * { text-align:left !important; }
body table, body td { text-align:left !important; }
body p, body h1, body h2, body h3, body h4, body h5, body h6,
body li, body blockquote, body div { text-align:left !important; }
</style>`

    if (out.includes("</head>")) {
      out = out.replace("</head>", `${overrideStyle}</head>`)
    } else if (out.includes("<body")) {
      // No <head> — drop the style at the top of <body>.
      out = out.replace(/(<body\b[^>]*>)/i, `$1${overrideStyle}`)
    } else {
      out = `${overrideStyle}${out}`
    }
  }

  // 2. Inline-style every block tag for clients that strip <style>.
  out = inlinePlainBlockStyles(out)

  return out
}

/** Extract a readable plain-text version for the text/plain MIME alternative. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
