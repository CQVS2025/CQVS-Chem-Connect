"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, ExternalLink, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ProductOption {
  id: string
  name: string
  slug: string
}

interface Props {
  products: ProductOption[]
}

interface GeneratedLink {
  share_url: string
  slug: string
  expires_at: string | null
  max_uses: number | null
}

const EXPIRY_CHOICES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days (default)" },
  { value: "90", label: "90 days" },
  { value: "never", label: "No expiry (e.g. email signature)" },
] as const

export function GenerateShareLinkDialog({ products }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [productId, setProductId] = useState("")
  const [expiry, setExpiry] = useState<(typeof EXPIRY_CHOICES)[number]["value"]>("30")
  const [maxUses, setMaxUses] = useState("50")
  const [busy, setBusy] = useState(false)
  const [generated, setGenerated] = useState<GeneratedLink | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setProductId("")
    setExpiry("30")
    setMaxUses("50")
    setGenerated(null)
    setCopied(false)
  }

  async function handleGenerate() {
    if (!productId) {
      toast.error("Pick a product first.")
      return
    }
    const expiresInDays = expiry === "never" ? null : Number(expiry)
    const trimmedMax = maxUses.trim()
    const parsedMax = trimmedMax === "" ? null : Number(trimmedMax)
    if (parsedMax !== null && (!Number.isInteger(parsedMax) || parsedMax < 1)) {
      toast.error("Max uses must be a whole number >= 1, or blank for unlimited.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/admin/reviews/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          expiresInDays,
          maxUses: parsedMax,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to generate link")
      setGenerated(json.link)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate link")
    } finally {
      setBusy(false)
    }
  }

  async function copyToClipboard() {
    if (!generated) return
    try {
      await navigator.clipboard.writeText(generated.share_url)
      setCopied(true)
      toast.success("Link copied to clipboard.")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy automatically - select the URL and copy manually.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 size-4" />
          Generate share link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        {!generated ? (
          <>
            <DialogHeader>
              <DialogTitle>Generate public review link</DialogTitle>
              <DialogDescription>
                Anyone with this URL can leave a review for the selected
                product without logging in. Reviews submitted via a share
                link display as <em>&ldquo;Reviewer&rdquo;</em> (not Verified
                buyer) and don&rsquo;t count toward the headline rating.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  Product
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry</Label>
                <Select
                  value={expiry}
                  onValueChange={(v) => setExpiry(v as typeof expiry)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_CHOICES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  After expiry the link returns &ldquo;no longer active&rdquo;
                  to anyone who clicks it.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Max uses</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="50"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for unlimited. Once the cap is reached the link
                  stops accepting submissions.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={busy}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Generate link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Your share link is ready</DialogTitle>
              <DialogDescription>
                Copy and drop this URL anywhere - quote PDFs, WhatsApp,
                follow-up emails, your email signature. Anyone who clicks it
                lands on a public review form for this product.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                <code className="block break-all text-xs text-foreground">
                  {generated.share_url}
                </code>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={copyToClipboard} disabled={copied}>
                  {copied ? (
                    <>
                      <Check className="mr-2 size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 size-4" />
                      Copy URL
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={generated.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    Preview in new tab
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expiry:{" "}
                {generated.expires_at
                  ? new Date(generated.expires_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "never"}
                {" · "}
                Max uses: {generated.max_uses ?? "unlimited"}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
