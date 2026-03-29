"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { ImagePlus, Loader2, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ProductImageData {
  id: string
  image_url: string
  is_cover: boolean
  sort_order: number
}

interface ProductImageManagerProps {
  productId: string
  legacyImageUrl?: string | null
}

export function ProductImageManager({ productId, legacyImageUrl }: ProductImageManagerProps) {
  const [images, setImages] = useState<ProductImageData[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/images`)
      if (res.ok) {
        const data = await res.json()
        setImages(data)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  async function handleUpload(files: FileList) {
    setUploading(true)
    const formData = new FormData()

    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i])
    }

    // First image becomes cover only if no images AND no legacy image
    if (images.length === 0 && !legacyImageUrl) {
      formData.append("is_cover", "true")
    }

    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast.success(`${files.length} image${files.length > 1 ? "s" : ""} uploaded`)
        fetchImages()
      } else {
        toast.error("Unable to upload images. Please try again.")
      }
    } catch {
      toast.error("Unable to upload images. Please try again.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleSetCover(imageId: string) {
    const tid = toast.loading("Setting cover image...")
    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId }),
      })

      if (res.ok) {
        toast.success("Cover image updated", { id: tid })
        fetchImages()
      } else {
        toast.error("Unable to set cover image.", { id: tid })
      }
    } catch {
      toast.error("Unable to set cover image.", { id: tid })
    }
  }

  async function handleDelete(imageId: string) {
    const tid = toast.loading("Removing image...")
    try {
      const res = await fetch(`/api/products/${productId}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId }),
      })

      if (res.ok) {
        toast.success("Image removed", { id: tid })
        fetchImages()
      } else {
        toast.error("Unable to remove image.", { id: tid })
      }
    } catch {
      toast.error("Unable to remove image.", { id: tid })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Product Images ({images.length})
        </p>
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
            <ImagePlus className="mr-2 h-3 w-3" />
          )}
          {uploading ? "Uploading..." : "Add Images"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleUpload(e.target.files)
            }
          }}
        />
      </div>

      {images.length === 0 && legacyImageUrl ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Current cover image. Upload additional images or click the + button to add more.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-primary ring-2 ring-primary/20">
              <Image
                src={legacyImageUrl}
                alt="Current cover"
                fill
                sizes="120px"
                className="object-cover"
              />
              <div className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                COVER
              </div>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
            </button>
          </div>
        </div>
      ) : images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            Click to upload product images
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            JPG, PNG, WebP. Max 5MB each. First image becomes cover.
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                img.is_cover
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30",
              )}
            >
              <Image
                src={img.image_url}
                alt="Product"
                fill
                sizes="120px"
                className="object-cover"
              />

              {/* Cover badge */}
              {img.is_cover && (
                <div className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                  COVER
                </div>
              )}

              {/* Action overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {!img.is_cover && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 border-white/30 bg-black/30 text-white hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleSetCover(img.id)}
                    title="Set as cover"
                  >
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 border-white/30 bg-black/30 text-white hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDelete(img.id)}
                  title="Delete image"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {/* Add more button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-muted/50"
          >
            <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
          </button>
        </div>
      )}
    </div>
  )
}
