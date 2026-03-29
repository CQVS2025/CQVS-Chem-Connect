"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { FileText, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

interface ProductDoc {
  id: string
  file_name: string
  file_size: number
  file_type: string
  doc_type: string
}

interface ProductDocumentManagerProps {
  productId: string
}

export function ProductDocumentManager({ productId }: ProductDocumentManagerProps) {
  const [docs, setDocs] = useState<ProductDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/documents`)
      if (res.ok) setDocs(await res.json())
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  async function handleUpload(files: FileList) {
    setUploading(true)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i])
    }
    formData.append("doc_type", "sds")

    try {
      const res = await fetch(`/api/products/${productId}/documents`, {
        method: "POST",
        body: formData,
      })
      if (res.ok) {
        toast.success("Document uploaded")
        fetchDocs()
      } else {
        toast.error("Unable to upload document.")
      }
    } catch {
      toast.error("Unable to upload document.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDelete(docId: string) {
    const tid = toast.loading("Removing document...")
    try {
      const res = await fetch(`/api/products/${productId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      })
      if (res.ok) {
        toast.success("Document removed", { id: tid })
        fetchDocs()
      } else {
        toast.error("Unable to remove document.", { id: tid })
      }
    } catch {
      toast.error("Unable to remove document.", { id: tid })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading documents...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">SDS Documents ({docs.length})</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Upload className="mr-2 h-3 w-3" />
          )}
          {uploading ? "Uploading..." : "Upload SDS"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleUpload(e.target.files)
            }
          }}
        />
      </div>

      {docs.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <FileText className="h-4 w-4" />
          No SDS documents. Click to upload.
        </button>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {(doc.file_size / 1024).toFixed(0)} KB - {doc.doc_type.toUpperCase()}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
