"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
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

export default function ThreadPage() {
  const params = useParams<{ id: string }>()
  useInboxRealtime()

  const { data, isLoading } = useInboxThread(params.id)
  const sendReply = useSendReply()
  const markRead = useMarkThreadRead()

  const [body, setBody] = useState("")
  const endRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data?.messages.length])

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
      </div>
    )
  }

  const contact = pickContact(data.conversation.contact)
  const displayName =
    contact?.full_name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
    contact?.phone ||
    "Contact"

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
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/inbox">
            <ArrowLeft className="mr-2 h-4 w-4" /> Inbox
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{displayName}</h3>
            {contact?.is_opted_out && (
              <Badge variant="destructive" className="text-[10px]">
                Opted out
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {contact?.phone ?? ""}
            {contact?.email ? ` · ${contact.email}` : ""}
          </p>
        </div>
        {contact?.id && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/marketing/contacts/${contact.id}`}>
              View contact
            </Link>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-4">
        {data.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.messages.map((m) => (
              <li
                key={m.id}
                className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                    m.direction === "outbound"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      m.direction === "outbound"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {new Date(m.occurred_at).toLocaleString()}{" "}
                    {m.status && m.status !== "received" && `· ${m.status}`}
                  </p>
                </div>
              </li>
            ))}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      <div className="rounded-lg border p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
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

function pickContact(
  c: InboxContactSummary | InboxContactSummary[] | null,
): InboxContactSummary | null {
  if (!c) return null
  if (Array.isArray(c)) return c[0] ?? null
  return c
}
