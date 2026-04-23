"use client"

import Link from "next/link"
import { Inbox, Loader2 } from "lucide-react"

import {
  useInboxRealtime,
  useInboxThreads,
  type InboxContactSummary,
  type InboxThread,
} from "@/lib/hooks/use-marketing-inbox"

import { Badge } from "@/components/ui/badge"

export default function InboxPage() {
  useInboxRealtime()
  const { data, isLoading } = useInboxThreads()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Inbox className="h-4 w-4" /> SMS Inbox
        </h2>
        <p className="text-sm text-muted-foreground">
          Every inbound and outbound SMS thread. Click a thread to reply.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading threads…
        </div>
      )}

      <div className="rounded-lg border">
        {(data?.conversations ?? []).length === 0 && !isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No conversations yet. Inbound SMS will appear here in real time.
          </div>
        ) : (
          <ul className="divide-y">
            {(data?.conversations ?? []).map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ThreadRow({ thread }: { thread: InboxThread }) {
  const contact = pickContact(thread.contact)
  const displayName =
    contact?.full_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
    contact?.phone ||
    contact?.email ||
    "Unknown"

  return (
    <li>
      <Link
        href={`/admin/marketing/inbox/${thread.id}`}
        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40"
      >
        <div
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            thread.unread_count > 0 ? "bg-primary" : "bg-transparent"
          }`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
            {contact?.is_opted_out && (
              <Badge variant="destructive" className="text-[10px]">
                Opted out
              </Badge>
            )}
            {thread.unread_count > 0 && (
              <Badge className="text-[10px]">{thread.unread_count}</Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            <span className="text-[11px] uppercase text-muted-foreground/70">
              {thread.last_message_direction === "outbound" ? "You" : "Them"}:
            </span>{" "}
            {thread.last_message_preview ?? "(no preview)"}
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {thread.last_message_at
            ? new Date(thread.last_message_at).toLocaleString()
            : ""}
        </span>
      </Link>
    </li>
  )
}

function pickContact(
  c: InboxContactSummary | InboxContactSummary[] | null,
): InboxContactSummary | null {
  if (!c) return null
  if (Array.isArray(c)) return c[0] ?? null
  return c
}
