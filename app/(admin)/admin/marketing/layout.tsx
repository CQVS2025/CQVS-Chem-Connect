import { Megaphone } from "lucide-react"

/**
 * Marketing section layout — just the shared header.
 * Navigation between Dashboard / Contacts / Campaigns / Sequences / Inbox
 * / Settings is handled by the admin sidebar's nested sub-items.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Contacts, campaigns, and automations powered by GoHighLevel
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
