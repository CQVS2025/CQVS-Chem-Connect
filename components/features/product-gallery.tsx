"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { domAnimation, LazyMotion, m, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ProductImage {
  id: string
  image_url: string
  is_cover: boolean
  sort_order: number
}

interface ProductGalleryProps {
  images: ProductImage[]
  fallbackImage: string
  productName: string
  /**
   * Optional richer alt-text base. When provided, every image's alt is
   * built from this string instead of the bare product name - lifts SEO /
   * Google-Images discovery signal without changing the visible UI.
   */
  altText?: string
}

export function ProductGallery({
  images,
  fallbackImage,
  productName,
  altText,
}: ProductGalleryProps) {
  const altBase = altText ?? productName
  const [activeIndex, setActiveIndex] = useState(0)

  // If no images in gallery, show single fallback
  if (images.length === 0) {
    return (
      <div className="relative h-80 overflow-hidden rounded-xl bg-white sm:h-96 lg:h-112">
        <Image
          src={fallbackImage}
          alt={altBase}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>
    )
  }

  const currentImage = images[activeIndex]

  function goTo(index: number) {
    if (index < 0) setActiveIndex(images.length - 1)
    else if (index >= images.length) setActiveIndex(0)
    else setActiveIndex(index)
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="space-y-3">
        {/* Main image */}
        <div className="relative overflow-hidden rounded-xl bg-white">
          <div className="relative h-80 sm:h-96 lg:h-112">
            <AnimatePresence mode="wait">
              <m.div
                key={currentImage?.id || activeIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <Image
                  src={currentImage?.image_url || fallbackImage}
                  alt={`${altBase} - Image ${activeIndex + 1}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority={activeIndex === 0}
                />
              </m.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full border-white/20 bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white"
                  onClick={() => goTo(activeIndex - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-3 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full border-white/20 bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/60 hover:text-white"
                  onClick={() => goTo(activeIndex + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}

            {/* Image counter */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {activeIndex + 1} / {images.length}
              </div>
            )}

          </div>
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {images.map((img, index) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 sm:h-20 sm:w-20",
                  activeIndex === index
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                <Image
                  src={img.image_url}
                  alt={`${altBase} thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </LazyMotion>
  )
}
