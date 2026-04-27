"use client"

import { ExternalLink, GitBranch, Loader2 } from "lucide-react"

import { useSequences } from "@/lib/hooks/use-marketing-sequences"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const GHL_LOCATION_ID = "FQ5OnSrbC8BdZbTnWvp8"

/**
 * Sequences page — read-only mirror of GHL workflows.
 *
 * The "Enrol contact" action is intentionally disabled in the UI until Jonny
 * has customer-facing workflows worth enrolling people into. The underlying
 * API route (/api/marketing/sequences/[id]/enroll) and hooks still work — we
 * can re-enable the button by restoring the Enrol dialog from git history.
 */
export default function SequencesPage() {
  const { data, isLoading, isError } = useSequences()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GitBranch className="h-4 w-4" /> Sequences
        </h2>
        <p className="text-sm text-muted-foreground">
          Workflows built inside GoHighLevel. Read-only view - configure
          and edit them in GHL directly via the &ldquo;Open in GoHighLevel&rdquo;
          button on each card.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Fetching workflows from GHL…
        </div>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Could not load workflows from GoHighLevel. Check your connection in
          Settings.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(data?.workflows ?? []).map((s) => (
          <Card key={s.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{s.name}</span>
                <Badge
                  variant={s.status === "published" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {s.status ?? "published"}
                </Badge>
              </CardTitle>
              {s.updatedAt && (
                <CardDescription className="text-xs">
                  Last updated {new Date(s.updatedAt).toLocaleDateString()}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://app.gohighlevel.com/location/${GHL_LOCATION_ID}/workflow/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in GoHighLevel
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
        {data?.workflows.length === 0 && !isLoading && (
          <p className="col-span-full text-sm text-muted-foreground">
            No workflows found. Create one inside GoHighLevel to get started.
          </p>
        )}
      </div>
    </div>
  )
}
