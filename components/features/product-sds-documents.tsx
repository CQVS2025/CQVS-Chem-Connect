"use client"

import { useState, useEffect, useCallback } from "react"
import { FileText, Download, Eye, Lock } from "lucide-react"

import { useUser } from "@/lib/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"

interface SdsDoc {
  id: string
  file_name: string
  file_size: number
  file_type: string
  doc_type: string
  download_url: string | null
  view_url: string | null
}

interface ProductSdsDocumentsProps {
  productId: string
}

export function ProductSdsDocuments({ productId }: ProductSdsDocumentsProps) {
  const [docs, setDocs] = useState<SdsDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [authPrompt, setAuthPrompt] = useState(false)
  const { user } = useUser()

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocs(data)
      }
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (docs.length === 0) return null

  function handleDocClick(doc: SdsDoc, action: "view" | "download") {
    if (!user) {
      setAuthPrompt(true)
      return
    }

    const url = action === "download" ? doc.download_url : doc.view_url
    if (url) {
      if (action === "download") {
        const a = document.createElement("a")
        a.href = url
        a.download = doc.file_name
        a.click()
      } else {
        window.open(url, "_blank")
      }
    }
  }

  return (
    <>
      <Card className="border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Safety Data Sheets (SDS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-hidden rounded-lg">
            {/* Single locked overlay covering all docs */}
            {!user && (
              <button
                type="button"
                onClick={() => setAuthPrompt(true)}
                className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[3px] transition-all hover:bg-background/60"
              >
                <div className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 shadow-lg">
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Sign in to access</span>
                </div>
              </button>
            )}

            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-amber-500/10 bg-background px-3 py-2.5"
                >
                  <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(doc.file_size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {user && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleDocClick(doc, "view")}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleDocClick(doc, "download")}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <AuthPromptDialog
        open={authPrompt}
        onOpenChange={setAuthPrompt}
        title="Sign in to access SDS documents"
        description="Create an account or sign in to view and download Safety Data Sheets for this product."
      />
    </>
  )
}
