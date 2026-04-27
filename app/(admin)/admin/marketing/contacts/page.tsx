"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Tag as TagIcon,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import {
  useContactsRealtime,
  useForceSyncMarketingContacts,
  useMarketingContacts,
  type MarketingContact,
} from "@/lib/hooks/use-marketing-contacts"
import { useDebounce } from "@/lib/hooks/use-debounce"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 50

export default function MarketingContactsPage() {
  // Subscribe to realtime changes so webhook-driven updates appear live.
  useContactsRealtime()

  const [qInput, setQInput] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [page, setPage] = useState(1)

  // Debounce so we don't fire a query on every keystroke.
  const q = useDebounce(qInput, 250)
  const tag = useDebounce(tagInput, 250)

  const { data, isLoading, isFetching, refetch } = useMarketingContacts({
    q,
    tag,
    page,
    limit: PAGE_SIZE,
  })
  const forceSync = useForceSyncMarketingContacts()

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  async function handleForceSync() {
    // Sync is chunked (Vercel Hobby's 10s cap), so the toast starts as
    // "Re-syncing…" and the button itself shows live progress from
    // forceSync.progress while the hook iterates.
    const promise = forceSync.mutateAsync().then(async (res) => {
      await refetch()
      return res
    })
    toast.promise(promise, {
      loading: "Re-syncing from GoHighLevel…",
      success: (res) =>
        `Synced ${res.total} contacts (${res.created} new, ${res.updated} updated${res.purged ? `, ${res.purged} removed` : ""}${res.failed ? `, ${res.failed} failed` : ""}).`,
      error: "Sync failed",
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, or company…"
            value={qInput}
            onChange={(e) => {
              setPage(1)
              setQInput(e.target.value)
            }}
            className="pl-9"
          />
        </div>
        <div className="relative min-w-[180px]">
          <TagIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by tag…"
            value={tagInput}
            onChange={(e) => {
              setPage(1)
              setTagInput(e.target.value)
            }}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleForceSync}
          disabled={forceSync.isPending}
        >
          {forceSync.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {forceSync.isPending && forceSync.progress
            ? `Syncing ${forceSync.progress.totals.total}${
                forceSync.progress.ghlTotal !== null
                  ? `/${forceSync.progress.ghlTotal}`
                  : ""
              } contacts…`
            : "Re-sync from GHL"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/marketing/contacts/import">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Link>
        </Button>
        <Button asChild>
          <Link href="/admin/marketing/contacts/new">
            <Plus className="mr-2 h-4 w-4" />
            Add contact
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contacts…
          </span>
        ) : (
          <>
            <span>
              <strong className="text-foreground">{data?.total ?? 0}</strong>{" "}
              {data?.total === 1 ? "contact" : "contacts"}
            </span>
            {isFetching && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Refreshing
              </span>
            )}
          </>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.contacts ?? []).map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
            {data && data.contacts.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No contacts match your filters. Try clearing the search, or{" "}
                  <Link href="/admin/marketing/contacts/import" className="text-primary hover:underline">
                    import a CSV
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <Download className="mr-1 inline h-3 w-3" />
        Contacts mirror the GoHighLevel sub-account <code className="rounded bg-muted px-1">CQVS</code>. Changes made here sync both ways.
      </p>
    </div>
  )
}

function ContactRow({ contact }: { contact: MarketingContact }) {
  const displayName =
    contact.full_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "—"

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="font-medium">
        <Link
          href={`/admin/marketing/contacts/${contact.id}`}
          className="hover:underline"
        >
          {displayName}
        </Link>
      </TableCell>
      <TableCell className="text-sm">{contact.email ?? "—"}</TableCell>
      <TableCell className="text-sm">{contact.phone ?? "—"}</TableCell>
      <TableCell className="text-sm">{contact.company_name ?? "—"}</TableCell>
      <TableCell className="text-sm">{contact.city ?? "—"}</TableCell>
      <TableCell className="text-sm">{contact.state ?? "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
          {contact.tags.length > 3 && (
            <Badge variant="outline" className="text-[10px]">
              +{contact.tags.length - 3}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {contact.is_opted_out ? (
          <Badge variant="destructive" className="text-[10px]">
            Opted out
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            Active
          </Badge>
        )}
      </TableCell>
    </TableRow>
  )
}
