"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Loader2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface ShareLinkRowData {
  id: string
  slug: string
  share_url: string
  product_id: string
  expires_at: string | null
  max_uses: number | null
  used_count: number
  is_active: boolean
  created_at: string
  products?: { id: string; name: string; slug: string } | null
}

interface Props {
  links: ShareLinkRowData[]
}

function statusOf(link: ShareLinkRowData):
  | { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
{
  if (!link.is_active) return { label: "Revoked", variant: "destructive" }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) {
    return { label: "Expired", variant: "outline" }
  }
  if (link.max_uses !== null && link.used_count >= link.max_uses) {
    return { label: "Exhausted", variant: "outline" }
  }
  return { label: "Active", variant: "default" }
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never"
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ShareLinksTab({ links }: Props) {
  const router = useRouter()
  const [revokeTarget, setRevokeTarget] = useState<ShareLinkRowData | null>(null)
  const [busy, setBusy] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-14 text-center">
        <div className="rounded-full bg-muted p-3">
          <Link2 className="size-5 text-muted-foreground/60" />
        </div>
        <div className="max-w-md space-y-1">
          <p className="text-sm font-medium">No share links yet</p>
          <p className="text-xs text-muted-foreground">
            Generate a public review link from the button above. The URL can
            go anywhere - quote PDFs, WhatsApp, follow-up emails, the email
            signature. Anyone who clicks it can leave a review for the linked
            product without an account.
          </p>
        </div>
      </div>
    )
  }

  async function copy(link: ShareLinkRowData) {
    try {
      await navigator.clipboard.writeText(link.share_url)
      setCopiedSlug(link.slug)
      toast.success("Link copied.")
      setTimeout(() => setCopiedSlug(null), 2000)
    } catch {
      toast.error("Couldn't copy automatically.")
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/reviews/share-links/${revokeTarget.id}/revoke`,
        { method: "POST" },
      )
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Revoke failed")
      }
      toast.success("Link revoked.")
      setRevokeTarget(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => {
              const status = statusOf(link)
              const usage = link.max_uses
                ? `${link.used_count} / ${link.max_uses}`
                : `${link.used_count}`
              return (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">
                    {link.products?.name ?? "Unknown product"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">
                      ...{link.slug.slice(-6)}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(link.expires_at)}
                  </TableCell>
                  <TableCell className="text-sm">{usage}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(link.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copy(link)}
                        title="Copy URL"
                      >
                        {copiedSlug === link.slug ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        title="Open public submit page in a new tab"
                      >
                        <a
                          href={link.share_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        title="View submissions from this link"
                      >
                        <Link
                          href={`/admin/marketing/reviews?share_link_id=${link.id}`}
                        >
                          <Eye className="size-4" />
                        </Link>
                      </Button>
                      {link.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setRevokeTarget(link)}
                          title="Revoke link"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!revokeTarget} onOpenChange={(v) => !v && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this share link?</DialogTitle>
            <DialogDescription>
              The link will stop working immediately for anyone who tries to
              open it. Reviews already submitted via this link aren&rsquo;t
              affected - they stay in the moderation queue.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="size-4" />
              <span>
                Product: <strong className="text-foreground">{revokeTarget?.products?.name}</strong>
              </span>
            </div>
            {revokeTarget && (
              <code className="mt-1 block break-all text-[11px] text-muted-foreground">
                {revokeTarget.share_url}
              </code>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Revoke link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
