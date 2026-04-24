"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import {
  useInboxRealtime,
  useInboxThread,
  useMarkThreadRead,
  useSendReply,
  type InboxContactSummary,
} from "@/lib/hooks/use-marketing-inbox"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ThreadMessage {
  id: string
  direction: "inbound" | "outbound" | string
  body: string
  occurred_at: string
  status?: string | null
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>()
  useInboxRealtime()

  const { data, isLoading } = useInboxThread(params.id)
  const sendReply = useSendReply()
  const markRead = useMarkThreadRead()

  const [body, setBody] = useState("")
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Auto-mark as read once per conversation open. The ref guard prevents
  // re-firing on every realtime refetch while the thread is open.
  const markedRef = useRef<string | null>(null)
  useEffect(() => {
    const convoId = data?.conversation.id
    if (!convoId) return
    if (markedRef.current === convoId) return
    if ((data?.conversation.unread_count ?? 0) <= 0) return
    markedRef.current = convoId
    markRead.mutate(convoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.conversation.id])

  // Scroll to bottom whenever a new message lands. scrollTop = scrollHeight
  // is more reliable than scrollIntoView inside an overflow-hidden parent
  // (scrollIntoView can scroll the outer admin shell instead).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [data?.messages.length])

  const grouped = useMemo(
    () => groupByDay((data?.messages as ThreadMessage[]) ?? []),
    [data?.messages],
  )

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
      </div>
    )
  }

  const contact = pickContact(data.conversation.contact)
  const nameFromFields =
    contact?.full_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
    null
  const displayName = nameFromFields || contact?.phone || "Unknown contact"
  // Only show phone in the subtitle if the display name isn't already the phone.
  const showPhoneInSubtitle = !!contact?.phone && displayName !== contact.phone

  async function handleSend() {
    const payload = body.trim()
    if (!payload) return
    setBody("")
    const promise = sendReply.mutateAsync({ id: params.id, body: payload })
    toast.promise(promise, {
      loading: "Sending…",
      success: "Sent",
      error: (err) => (err instanceof Error ? err.message : "Send failed"),
    })
  }

  return (
    // Use dynamic viewport height so mobile URL bar resize doesn't clip.
    // min-h-0 is needed inside the flex chain so the children can actually
    // shrink instead of pushing the container past the viewport.
    <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/inbox">
            <ArrowLeft className="mr-2 h-4 w-4" /> Inbox
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={displayName} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{displayName}</h3>
              {contact?.is_opted_out && (
                <Badge variant="destructive" className="text-[10px]">
                  Opted out
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {showPhoneInSubtitle ? contact?.phone : ""}
              {contact?.email
                ? `${showPhoneInSubtitle ? " · " : ""}${contact.email}`
                : ""}
            </p>
          </div>
        </div>
        {contact?.id && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/marketing/contacts/${contact.id}`}>
              View contact
            </Link>
          </Button>
        )}
      </div>

      {/* Messages — scrollable pane. min-h-0 critical to let flex-1 shrink */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-4"
      >
        {data.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No messages yet. Send a reply to start the conversation.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {grouped.map((group) => (
              <li key={group.day} className="flex flex-col gap-2">
                <div className="sticky top-0 z-10 flex justify-center py-1">
                  <span className="rounded-full bg-background/80 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
                    {group.day}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {group.messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="rounded-lg border p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="max-h-40 min-h-[44px] resize-none"
          placeholder={
            contact?.is_opted_out
              ? "Contact has opted out — replies are blocked."
              : "Type a reply… (Enter to send, Shift+Enter for new line)"
          }
          disabled={contact?.is_opted_out}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {body.length} chars · {Math.max(1, Math.ceil(body.length / 160))} part(s)
          </span>
          <Button
            onClick={handleSend}
            disabled={
              !body.trim() || sendReply.isPending || !!contact?.is_opted_out
            }
          >
            {sendReply.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  const isOutbound = message.direction === "outbound"
  return (
    <li className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isOutbound
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border bg-card"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`mt-1 flex items-center gap-1.5 text-[10px] ${
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
          title={new Date(message.occurred_at).toLocaleString()}
        >
          <span>
            {new Date(message.occurred_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.status && message.status !== "received" && (
            <span className="opacity-80">· {message.status}</span>
          )}
        </p>
      </div>
    </li>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initials || "?"}
    </div>
  )
}

function groupByDay<T extends { occurred_at: string }>(
  messages: T[],
): Array<{ day: string; messages: T[] }> {
  const out: Array<{ day: string; messages: T[] }> = []
  let currentKey: string | null = null
  for (const m of messages) {
    const key = new Date(m.occurred_at).toDateString()
    if (key !== currentKey) {
      out.push({ day: formatDayLabel(m.occurred_at), messages: [m] })
      currentKey = key
    } else {
      out[out.length - 1].messages.push(m)
    }
  }
  return out
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  })
}

function pickContact(
  c: InboxContactSummary | InboxContactSummary[] | null,
): InboxContactSummary | null {
  if (!c) return null
  if (Array.isArray(c)) return c[0] ?? null
  return c
}
