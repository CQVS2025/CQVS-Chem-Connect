"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldX,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { get } from "@/lib/api/client"
import {
  useContactsRealtime,
  useDeleteMarketingContact,
  useMarketingContact,
  type MarketingEvent,
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

const GHL_LOCATION_ID = "FQ5OnSrbC8BdZbTnWvp8" // CQVS sub-account

const EVENTS_PAGE_SIZE = 20

export default function ContactProfilePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  useContactsRealtime()
  const [eventsPage, setEventsPage] = useState(1)
  const { data, isLoading, isError, isFetching } = useMarketingContact(params.id, {
    eventsPage,
    eventsSize: EVENTS_PAGE_SIZE,
  })
  const deleteMutation = useDeleteMarketingContact()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading contact…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-destructive">
        Could not load contact. It may have been deleted.
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/admin/marketing/contacts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to contacts
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const { contact, events, eventsPagination, conversation } = data
  const totalEventPages = eventsPagination?.totalPages ?? 1
  const totalEvents = eventsPagination?.total ?? events.length
  const displayName =
    contact.full_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    contact.email ||
    contact.phone ||
    "Contact"

  async function handleDeleteConfirmed() {
    try {
      await deleteMutation.mutateAsync(contact.id)
      toast.success("Contact deleted")
      router.push("/admin/marketing/contacts")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/contacts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">{displayName}</h2>
          <p className="text-sm text-muted-foreground">
            {contact.company_name ?? "No company"} · {contact.state ?? "—"}
          </p>
        </div>
        {contact.ghl_contact_id && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/contacts/detail/${contact.ghl_contact_id}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in GoHighLevel
            </a>
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Delete
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contact.email && (
              <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                {contact.email}
              </Row>
            )}
            {contact.phone && (
              <Row icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                {contact.phone}
              </Row>
            )}
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
              {[contact.state, contact.country].filter(Boolean).join(", ") || "—"}
            </Row>
            {contact.is_opted_out && (
              <Row icon={<ShieldX className="h-3.5 w-3.5" />} label="Status">
                <Badge variant="destructive" className="text-[10px]">
                  Opted out
                </Badge>
              </Row>
            )}
            <Row label="Source">
              <Badge variant="secondary" className="text-[10px]">
                {contact.source}
              </Badge>
            </Row>
            <Row label="Tags">
              {contact.tags.length === 0 ? (
                <span className="text-muted-foreground">None</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </Row>
            {contact.last_synced_at && (
              <Row label="Last synced">
                <span className="text-muted-foreground">
                  {new Date(contact.last_synced_at).toLocaleString()}
                </span>
              </Row>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <CardDescription>
              Email and SMS events captured from GoHighLevel webhooks
              {totalEvents > 0 && (
                <>
                  {" · "}
                  {totalEvents} total
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No events yet. Activity will appear here once a campaign is sent.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.map((ev) => (
                  <EventRow key={ev.id} event={ev} />
                ))}
              </ul>
            )}
            {totalEventPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                <span className="text-muted-foreground">
                  Page {eventsPage} of {totalEventPages}
                  {isFetching && (
                    <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                  )}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                    disabled={eventsPage === 1 || isFetching}
                  >
                    <ChevronLeft className="mr-1 h-3 w-3" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEventsPage((p) => Math.min(totalEventPages, p + 1))
                    }
                    disabled={eventsPage >= totalEventPages || isFetching}
                  >
                    Next
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {conversation && (
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-sm">SMS conversation</CardTitle>
              <CardDescription>
                Latest message{" "}
                {conversation.last_message_at
                  ? new Date(conversation.last_message_at).toLocaleString()
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">
                {conversation.last_message_preview ?? "(no preview)"}
              </p>
            </CardContent>
          </Card>
        )}

        <SequenceHistoryCard contactId={contact.id} />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${displayName}?`}
        description="This removes the contact from GoHighLevel as well. Historical campaign events linked to them stay but lose the contact link. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  )
}

interface SequenceHistoryEntry {
  id: string
  action: string
  meta: { workflow_id?: string; ghl_contact_id?: string }
  occurred_at: string
}

function SequenceHistoryCard({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["contact-sequences", contactId],
    queryFn: () =>
      get<{ entries: SequenceHistoryEntry[] }>(
        `/marketing/contacts/${contactId}/sequences`,
      ),
  })

  return (
    <Card className="md:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4" /> Sequence history
        </CardTitle>
        <CardDescription>
          Workflows this contact has been enrolled in or removed from.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !data || data.entries.length === 0 ? (
          <p className="text-muted-foreground">
            No sequence activity yet. Enrol this contact from the Sequences tab.
          </p>
        ) : (
          <ul className="divide-y">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2">
                <Badge
                  variant={
                    e.action === "sequence.enrolled" ? "default" : "secondary"
                  }
                  className="text-[10px] capitalize"
                >
                  {e.action.replace("sequence.", "")}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {e.meta?.workflow_id ? e.meta.workflow_id.slice(0, 10) + "…" : ""}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.occurred_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div className="flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: MarketingEvent }) {
  return (
    <li className="flex items-start gap-3 rounded-md border px-3 py-2">
      <Badge variant="outline" className="text-[10px] capitalize">
        {event.event_type.replace(/_/g, " ")}
      </Badge>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">
          {new Date(event.occurred_at).toLocaleString()}
        </p>
        {typeof event.metadata === "object" &&
          event.metadata !== null &&
          "url" in event.metadata && (
            <p className="text-xs">
              <a
                href={String((event.metadata as { url?: string }).url ?? "#")}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {(event.metadata as { url?: string }).url}
              </a>
            </p>
          )}
      </div>
    </li>
  )
}
