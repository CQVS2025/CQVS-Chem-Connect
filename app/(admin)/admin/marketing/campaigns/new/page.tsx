"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Eye,
  Loader2,
  Mail,
  MessageCircle,
  Save,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import {
  useCreateCampaign,
  type CampaignType,
} from "@/lib/hooks/use-marketing-campaigns"
import {
  useMarketingContacts,
  useMarketingContactTags,
} from "@/lib/hooks/use-marketing-contacts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { QuillEditor } from "@/components/marketing/quill-editor"
import {
  buildMarketingEmailHtml,
  htmlToPlainText,
} from "@/lib/marketing/email-template"
import { MERGE_TAGS } from "@/lib/marketing/merge-tags"
import { useDebounce } from "@/lib/hooks/use-debounce"

type Step = "who" | "what" | "when" | "review"

export default function NewCampaignPage() {
  const router = useRouter()
  const createCampaign = useCreateCampaign()

  const [step, setStep] = useState<Step>("who")
  const [name, setName] = useState("")
  const [type, setType] = useState<CampaignType>("email")

  // Audience
  const [audienceMode, setAudienceMode] = useState<"all" | "tag">("all")
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [tagMatchAll, setTagMatchAll] = useState(true)
  const { data: availableTagsData } = useMarketingContactTags()
  const availableTags = availableTagsData?.tags ?? []
  const suggestedTags = useMemo(() => {
    const draft = tagDraft.trim().toLowerCase()
    return availableTags
      .filter((t) => !tags.includes(t.tag))
      .filter((t) => !draft || t.tag.toLowerCase().includes(draft))
  }, [availableTags, tags, tagDraft])

  function addTag(value?: string) {
    const t = (value ?? tagDraft).trim()
    if (!t) return
    if (tags.includes(t)) {
      setTagDraft("")
      return
    }
    setTags([...tags, t])
    setTagDraft("")
  }
  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t))
  }

  // Content
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [bodyText, setBodyText] = useState("")
  // Compose mode — rich text via Quill, wrapped in the branded shell on save.
  // The existing HTML-paste mode is kept for Claude-generated templates.
  const [contentMode, setContentMode] = useState<"compose" | "html">("compose")
  const [composedHtml, setComposedHtml] = useState("")
  const composedEmailHtml = useMemo(
    () =>
      composedHtml.trim()
        ? buildMarketingEmailHtml({
            heading: subject.trim() || "New from Chem Connect",
            preheader: preheader.trim() || undefined,
            bodyHtml: composedHtml,
          })
        : "",
    [composedHtml, subject, preheader],
  )

  // Schedule
  const [mode, setMode] = useState<"now" | "schedule">("now")
  const [scheduledAt, setScheduledAt] = useState("")

  const audienceFilter = useMemo(() => {
    if (audienceMode === "tag" && tags.length > 0)
      return { tags, tagMatchAll }
    return { all: true }
  }, [audienceMode, tags, tagMatchAll])

  const { data: preview, isFetching: isPreviewFetching } =
    useMarketingContacts({
      tags: audienceMode === "tag" && tags.length > 0 ? tags : undefined,
      tagMatchAll: audienceMode === "tag" ? tagMatchAll : undefined,
      limit: 1,
    })
  const audienceCount = preview?.total ?? 0

  function canAdvance(): boolean {
    // Block progression while async work is in flight for the current step.
    if (isPreviewFetching) return false
    if (step === "who") return audienceMode === "all" || tags.length > 0
    if (step === "what") {
      if (!name.trim()) return false
      if (type === "email") {
        if (!subject.trim()) return false
        return contentMode === "compose"
          ? !!composedHtml.replace(/<[^>]+>/g, "").trim()
          : !!bodyHtml.trim()
      }
      return !!bodyText.trim()
    }
    if (step === "when") return mode === "now" || !!scheduledAt
    return true
  }

  async function handleSubmit() {
    try {
      const finalBodyHtml =
        type === "email"
          ? contentMode === "compose"
            ? composedEmailHtml
            : bodyHtml
          : undefined
      const finalBodyText =
        type === "email" && contentMode === "compose"
          ? htmlToPlainText(composedHtml)
          : bodyText
      const input = {
        name: name.trim(),
        type,
        audience_filter: audienceFilter,
        ...(type === "email"
          ? {
              subject: subject.trim(),
              preheader: preheader.trim() || undefined,
              body_html: finalBodyHtml,
              body_text: finalBodyText || undefined,
            }
          : { body_text: bodyText }),
        scheduled_at: mode === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
      }
      const result = await createCampaign.mutateAsync(input)
      toast.success("Campaign saved as draft")
      router.push(`/admin/marketing/campaigns/${result.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">New campaign</h2>
          <p className="text-sm text-muted-foreground">
            Four steps: who, what, when, review.
          </p>
        </div>
      </div>

      <StepIndicator current={step} />

      {step === "who" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> Step 1 — Audience
            </CardTitle>
            <CardDescription>
              Who should receive this campaign?
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Channel</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === "email" ? "default" : "outline"}
                  onClick={() => setType("email")}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={type === "sms" ? "default" : "outline"}
                  onClick={() => setType("sms")}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  SMS
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Audience</Label>
              <Select
                value={audienceMode}
                onValueChange={(v) => setAudienceMode(v as typeof audienceMode)}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contacts</SelectItem>
                  <SelectItem value="tag">Filter by tag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audienceMode === "tag" && (
              <div>
                <Label className="mb-1.5">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="Type a tag, press Enter to add. e.g. quarries"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addTag()}
                    disabled={!tagDraft.trim()}
                  >
                    Add
                  </Button>
                </div>
                {suggestedTags.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Available tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTags.map((t) => (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => addTag(t.tag)}
                          className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 bg-background px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          {t.tag}
                          <span className="text-[10px] opacity-70">
                            {t.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="ml-0.5 text-primary/70 hover:text-primary"
                          aria-label={`Remove tag ${t}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {tags.length > 1 && (
                  <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!tagMatchAll}
                      onChange={(e) => setTagMatchAll(!e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    Match <strong>any</strong> of these tags (default: match all)
                  </label>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {tags.length === 0
                    ? "Add one or more tags to narrow the audience."
                    : tagMatchAll
                      ? `Contacts must have ALL ${tags.length} tag(s).`
                      : `Contacts with ANY of the ${tags.length} tag(s).`}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              {isPreviewFetching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Calculating audience size…
                  </span>
                </>
              ) : (
                <span>
                  This campaign will reach approximately{" "}
                  <strong>{audienceCount}</strong> contact(s). Final count
                  confirmed at send time.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "what" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Step 2 — Content</CardTitle>
            <CardDescription>
              {type === "email"
                ? "Compose the body using the editor, or paste full HTML for Claude-generated templates."
                : "SMS body — keep under 160 chars for single-part delivery."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5">Campaign name (internal)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eco Wash Launch — QLD"
              />
            </div>
            {type === "email" ? (
              <>
                <div>
                  <Label className="mb-1.5">Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Preheader (optional)</Label>
                  <Input
                    value={preheader}
                    onChange={(e) => setPreheader(e.target.value)}
                    placeholder="Preview text shown under the subject in most inboxes"
                  />
                </div>
                <MergeTagsPanel />
                <div>
                  <Label className="mb-1.5">Body</Label>
                  <div className="mb-2 inline-flex rounded-md border p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setContentMode("compose")}
                      className={`rounded px-3 py-1 transition ${
                        contentMode === "compose"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Compose
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentMode("html")}
                      className={`rounded px-3 py-1 transition ${
                        contentMode === "html"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Paste HTML
                    </button>
                  </div>

                  {contentMode === "compose" ? (
                    <>
                      <QuillEditor
                        value={composedHtml}
                        onChange={setComposedHtml}
                        placeholder="Write the message body. Formatting and links are supported. The CQVS branded header and footer are added automatically."
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Only the body is editable — the CQVS header, colors,
                        and footer are applied on send.
                      </p>
                    </>
                  ) : (
                    <Textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      rows={16}
                      className="font-mono text-xs"
                      placeholder="<html>…</html>"
                    />
                  )}
                </div>
                <EmailPreviewIframe
                  srcDoc={
                    contentMode === "compose" ? composedEmailHtml : bodyHtml
                  }
                />
              </>
            ) : (
              <div>
                <Label className="mb-1.5">SMS body</Label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {bodyText.length} chars ·{" "}
                  {Math.max(1, Math.ceil(bodyText.length / 160))} SMS part(s)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "when" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" /> Step 3 — When
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "now" ? "default" : "outline"}
                onClick={() => setMode("now")}
              >
                Send now (manual trigger on next screen)
              </Button>
              <Button
                type="button"
                variant={mode === "schedule" ? "default" : "outline"}
                onClick={() => setMode("schedule")}
              >
                Schedule
              </Button>
            </div>
            {mode === "schedule" && (
              <div>
                <Label className="mb-1.5">Send at</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved as a scheduled draft. You can still review or cancel before it sends.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" /> Step 4 — Review
            </CardTitle>
            <CardDescription>
              Last chance to sanity-check before saving as a draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <KV label="Name">{name || "(untitled)"}</KV>
            <KV label="Channel">
              <Badge variant="secondary" className="gap-1">
                {type === "email" ? (
                  <Mail className="h-3 w-3" />
                ) : (
                  <MessageCircle className="h-3 w-3" />
                )}
                {type.toUpperCase()}
              </Badge>
            </KV>
            <KV label="Audience">
              {audienceMode === "all"
                ? "All contacts"
                : `Tags (${tagMatchAll ? "all of" : "any of"}): ${tags.join(", ")}`}
            </KV>
            <KV label="Audience size">~{audienceCount}</KV>
            {type === "email" && <KV label="Subject">{subject}</KV>}
            <KV label="Timing">
              {mode === "now" ? "Manual send from the detail page" : `Scheduled for ${scheduledAt}`}
            </KV>
            <Button
              onClick={handleSubmit}
              disabled={createCampaign.isPending || isPreviewFetching}
              className="mt-4 w-fit"
            >
              {createCampaign.isPending || isPreviewFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {createCampaign.isPending
                ? "Saving…"
                : isPreviewFetching
                  ? "Calculating audience…"
                  : "Save as draft"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === "who"}
          onClick={() => setStep(prevStep(step))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {step !== "review" && (
          <Button
            onClick={() => setStep(nextStep(step))}
            disabled={!canAdvance()}
          >
            {isPreviewFetching && step === "who" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating…
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ["who", "what", "when", "review"]
  return (
    <div className="flex gap-2">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
            s === current
              ? "bg-primary text-primary-foreground"
              : steps.indexOf(current) > i
                ? "bg-muted text-foreground"
                : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {i + 1}. {s}
        </div>
      ))}
    </div>
  )
}

function nextStep(step: Step): Step {
  if (step === "who") return "what"
  if (step === "what") return "when"
  if (step === "when") return "review"
  return "review"
}

function prevStep(step: Step): Step {
  if (step === "review") return "when"
  if (step === "when") return "what"
  if (step === "what") return "who"
  return "who"
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="min-w-[110px] text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex-1">{children}</span>
    </div>
  )
}

/**
 * Click-to-copy panel listing every merge tag the dispatcher supports.
 *
 * Rendered above the body editor so authors know the exact syntax
 * (matches GHL's `{{first_name}}` convention) and don't have to memorise
 * the available fields. Clicking a chip copies the tag to clipboard so
 * it can be pasted into the subject or body.
 */
function MergeTagsPanel() {
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(tag: string) {
    try {
      await navigator.clipboard.writeText(tag)
      setCopied(tag)
      toast.success(`Copied ${tag}`)
      setTimeout(() => setCopied((v) => (v === tag ? null : v)), 1500)
    } catch {
      toast.error("Copy failed — copy manually")
    }
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Available variables
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        Use these in the subject or body. Replaced per recipient at send time.
        Click a chip to copy. Hover for fallback.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MERGE_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => copy(t.label)}
            title={`${t.description}\nExample value: "${t.example}"\nFallback if missing: ${
              t.smartDefault ? `"${t.smartDefault}"` : "(empty)"
            }`}
            className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs transition ${
              copied === t.label
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted-foreground/30 bg-background text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <p>
          If a contact is missing the field, smart defaults kick in —
          e.g. <span className="font-mono">{"{{first_name}}"}</span> becomes{" "}
          <span className="font-mono">&quot;there&quot;</span>.
        </p>
        <p>
          Need a different fallback? Use{" "}
          <span className="font-mono">{"{{first_name | mate}}"}</span> to
          override per-use, or{" "}
          <span className="font-mono">{"{{first_name | }}"}</span> to force
          empty.
        </p>
      </div>
    </div>
  )
}

/**
 * Email preview iframe with reliable srcdoc updates.
 *
 * React's iframe `srcDoc` prop is flaky — Chrome sometimes doesn't reload
 * when the string changes, which shows up as a blank white preview on
 * first paint. Mounting/unmounting the iframe always works, so we key it
 * on a debounced copy of srcDoc. That keeps updates smooth while typing
 * (no flicker on every keystroke) and guarantees the iframe re-renders
 * when the user settles.
 */
function EmailPreviewIframe({ srcDoc }: { srcDoc: string }) {
  const debouncedSrc = useDebounce(srcDoc, 250)
  if (!debouncedSrc) return null
  return (
    <div>
      <Label className="mb-1.5">Live preview</Label>
      <iframe
        key={debouncedSrc}
        className="h-96 w-full rounded-md border bg-white"
        srcDoc={debouncedSrc}
        sandbox=""
        title="Email preview"
      />
    </div>
  )
}
