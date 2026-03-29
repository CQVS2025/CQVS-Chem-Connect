"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Building2, Camera, Loader2, X } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { postForm } from "@/lib/api/client"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface LogoUploadProps {
  currentLogoUrl?: string | null
  onUploaded?: (url: string) => void
  onRemoved?: () => void
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
}

export function LogoUpload({
  currentLogoUrl,
  onUploaded,
  onRemoved,
  size = "md",
  className,
}: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const displayUrl = preview || currentLogoUrl

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return postForm<{ url: string }>("/upload-logo", formData)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WebP, or SVG file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 2MB.")
      return
    }

    // Show instant preview
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setPreview(data.url)
        onUploaded?.(data.url)
        toast.success("Logo uploaded successfully")
      },
      onError: () => {
        setPreview(null)
        toast.error("Unable to upload logo. Please try again.")
      },
      onSettled: () => {
        if (inputRef.current) inputRef.current.value = ""
      },
    })
  }

  function handleRemove() {
    setPreview(null)
    onRemoved?.()
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative group">
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors",
            "hover:border-primary/50 hover:bg-muted",
            sizeMap[size],
          )}
        >
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt="Company logo"
              fill
              className="object-contain p-1"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}

          {/* Overlay on hover */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </button>
        </div>

        {/* Remove button */}
        {displayUrl && !uploadMutation.isPending && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-transform hover:scale-110"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Uploading...
            </>
          ) : displayUrl ? (
            "Change Logo"
          ) : (
            "Upload Logo"
          )}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WebP, or SVG. Max 2MB.
        </p>
      </div>
    </div>
  )
}
