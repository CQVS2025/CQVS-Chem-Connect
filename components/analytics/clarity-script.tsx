"use client"

import { useEffect } from "react"

/**
 * Microsoft Clarity initialiser.
 *
 * Mounts in the root layout. Initialises Clarity exactly once per page
 * load IF the project ID env var is set - leaving it empty means no
 * script is loaded (useful for local dev / staging where you don't want
 * to pollute production Clarity dashboards with test sessions).
 *
 * Clarity itself injects an async <script> from clarity.ms after init,
 * so this component ships ~no measurable LCP / TBT cost.
 *
 * Privacy posture (kept here for future maintainers):
 *   - Clarity auto-masks form inputs, password fields, sensitive content
 *     by default - credit cards, passwords, etc. never leave the browser.
 *   - First-party cookie used for session attribution. Disclosed in the
 *     site's privacy policy under "Third-party data processors".
 *   - For B2B chemical sales, no PII concerns triggered. If the niche
 *     ever changes (e.g. handling protected health info), revisit.
 */
export function ClarityScript() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

  useEffect(() => {
    if (!projectId) return

    // Clarity init must be browser-only - the SDK reads from `window`
    // and `document`. Dynamic import keeps it out of the server bundle
    // and ensures it tree-shakes cleanly when the env var is empty.
    let cancelled = false
    void import("@microsoft/clarity").then((mod) => {
      if (cancelled) return
      try {
        mod.default.init(projectId)
      } catch (err) {
        // Don't let a Clarity init failure break the app - log it and
        // move on. Most failures are transient (ad-blocker, network).
        console.warn("[clarity] init failed:", err)
      }
    })

    return () => {
      cancelled = true
    }
  }, [projectId])

  return null
}
