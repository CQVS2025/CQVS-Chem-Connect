"use client"

/**
 * Thin React wrapper around Quill (classic rich-text editor).
 *
 * Why Quill: small, stable, zero React coupling, does the ~6 formatting
 * options a non-technical campaign author actually needs. We instantiate
 * Quill once on mount, attach a change listener, and pipe the HTML through
 * DOMPurify before surfacing it to the parent.
 *
 * Why DOMPurify: Quill's output is generally safe, but an author pasting
 * from Word / Google Docs can carry inline styles and unexpected tags.
 * The branded email template already controls typography via its own
 * CSS — we strip anything that isn't on the allowlist to prevent visual
 * drift and xss surfaces when this HTML is later embedded into the
 * template and sent as email.
 */

import { useEffect, useRef } from "react"
import type Quill from "quill"
import "quill/dist/quill.snow.css"

import DOMPurify from "dompurify"

const TOOLBAR = [
  [{ header: [2, 3, false] }],
  ["bold", "italic", "underline"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link", "blockquote"],
  ["clean"],
]

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "blockquote",
  "span",
]

const ALLOWED_ATTR = ["href", "target", "rel"]

export interface QuillEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** CSS min-height for the editor body. */
  minHeight?: number
}

export function QuillEditor({
  value,
  onChange,
  placeholder = "Write your message…",
  minHeight = 220,
}: QuillEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!editorRef.current || quillRef.current) return

    let cancelled = false
    void import("quill").then(({ default: QuillCtor }) => {
      if (cancelled || !editorRef.current) return
      const instance = new QuillCtor(editorRef.current, {
        theme: "snow",
        placeholder,
        modules: { toolbar: TOOLBAR },
      })
      if (value) {
        instance.clipboard.dangerouslyPasteHTML(value)
      }
      instance.on("text-change", () => {
        const raw = instance.root.innerHTML
        const clean = DOMPurify.sanitize(raw, {
          ALLOWED_TAGS,
          ALLOWED_ATTR,
        })
        onChangeRef.current(clean)
      })
      quillRef.current = instance
    })

    return () => {
      cancelled = true
    }
    // Intentionally empty deps: Quill is instantiated once per mount. Parent
    // controls the initial `value`; subsequent external updates are not
    // reconciled back into the editor (standard pattern to avoid cursor jumps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="cc-quill-wrap rounded-md border bg-background"
      style={{ ["--cc-editor-min-h" as string]: `${minHeight}px` }}
    >
      <div ref={editorRef} className="cc-editor-body" />
      <style jsx global>{`
        /* -- Structure ----------------------------------------------- */
        /* Wrap allows the link tooltip to escape the editor's content
           box without being clipped by the surrounding card. Positioning
           is relative so the tooltip pins to the wrap. */
        .cc-quill-wrap {
          position: relative;
          overflow: visible;
        }
        .ql-container.ql-snow {
          border: none;
          font-family: inherit;
          font-size: 14px;
          overflow: visible;
        }
        .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid var(--border);
        }
        .ql-editor {
          min-height: var(--cc-editor-min-h, 220px);
          color: var(--foreground);
        }
        .ql-editor.ql-blank::before {
          color: var(--muted-foreground);
          font-style: normal;
        }

        /* -- Link tooltip: anchor to the wrap, never escape horizontally - */
        .cc-quill-wrap .ql-snow .ql-tooltip {
          left: 12px !important;
          right: 12px;
          max-width: calc(100% - 24px);
          background-color: var(--popover, var(--background));
          color: var(--popover-foreground, var(--foreground));
          border: 1px solid var(--border);
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          padding: 6px 10px;
          z-index: 50;
        }
        .cc-quill-wrap .ql-snow .ql-tooltip::before {
          color: var(--muted-foreground);
        }
        .cc-quill-wrap .ql-snow .ql-tooltip input[type="text"] {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--foreground);
          border-radius: 4px;
          padding: 4px 8px;
          outline: none;
        }
        .cc-quill-wrap .ql-snow .ql-tooltip a.ql-action,
        .cc-quill-wrap .ql-snow .ql-tooltip a.ql-remove,
        .cc-quill-wrap .ql-snow .ql-tooltip a.ql-preview {
          color: var(--primary);
        }

        /* -- Dark mode contrast for toolbar icons + pickers ------------- */
        /* Quill's Snow theme hardcodes near-black strokes/fills which are
           almost invisible on our dark admin panel. Swap to foreground. */
        .dark .cc-quill-wrap .ql-snow .ql-stroke {
          stroke: var(--foreground);
        }
        .dark .cc-quill-wrap .ql-snow .ql-fill,
        .dark .cc-quill-wrap .ql-snow .ql-stroke.ql-fill {
          fill: var(--foreground);
        }
        .dark .cc-quill-wrap .ql-snow .ql-picker {
          color: var(--foreground);
        }
        .dark .cc-quill-wrap .ql-snow .ql-picker-options {
          background-color: var(--popover, var(--background));
          border-color: var(--border);
          color: var(--foreground);
        }
        .dark .cc-quill-wrap .ql-snow .ql-picker-label {
          color: var(--foreground);
        }
        /* Hover / active states still visible */
        .dark .cc-quill-wrap .ql-snow.ql-toolbar button:hover .ql-stroke,
        .dark .cc-quill-wrap .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .dark
          .cc-quill-wrap
          .ql-snow.ql-toolbar
          .ql-picker-label:hover
          .ql-stroke {
          stroke: var(--primary);
        }
        .dark .cc-quill-wrap .ql-snow.ql-toolbar button:hover .ql-fill,
        .dark .cc-quill-wrap .ql-snow.ql-toolbar button.ql-active .ql-fill {
          fill: var(--primary);
        }
      `}</style>
    </div>
  )
}
