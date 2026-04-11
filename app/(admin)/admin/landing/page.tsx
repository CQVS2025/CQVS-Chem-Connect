"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { get, put } from "@/lib/api/client"
import { useProducts } from "@/lib/hooks/use-products"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageTransition } from "@/components/shared/page-transition"

interface LandingFeaturedResponse {
  hero: string[]
  featured: string[]
}

const HERO_SLOTS = 3
const FEATURED_SLOTS = 6
const NONE_VALUE = "__none__"

export default function AdminLandingPage() {
  const { data: products, isLoading: productsLoading } = useProducts()

  const [hero, setHero] = useState<(string | null)[]>(
    Array(HERO_SLOTS).fill(null),
  )
  const [featured, setFeatured] = useState<(string | null)[]>(
    Array(FEATURED_SLOTS).fill(null),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    get<LandingFeaturedResponse>("/admin/landing-featured")
      .then((data) => {
        if (cancelled) return
        setHero(padSlots(data.hero, HERO_SLOTS))
        setFeatured(padSlots(data.featured, FEATURED_SLOTS))
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load current selections.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const productMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; price: number; unit: string }>()
    for (const p of products ?? []) {
      map.set(p.id, { id: p.id, name: p.name, price: p.price, unit: p.unit })
    }
    return map
  }, [products])

  function updateHero(index: number, value: string | null) {
    setHero((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function updateFeatured(index: number, value: string | null) {
    setFeatured((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await put("/admin/landing-featured", {
        hero: hero.filter((id): id is string => !!id),
        featured: featured.filter((id): id is string => !!id),
      })
      toast.success("Landing page selections saved.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save selections.",
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading || productsLoading) {
    return (
      <PageTransition>
        <div className="space-y-8">
          <div>
            <Skeleton className="h-9 w-72" />
            <Skeleton className="mt-2 h-5 w-96" />
          </div>
          <Skeleton className="h-80" />
          <Skeleton className="h-[420px]" />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Landing Page</h1>
            <p className="text-muted-foreground">
              Choose which products appear in the hero ticker and the Live
              Pricing grid on the homepage.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>

        <SlotSection
          title="Hero Ticker"
          description="Three products rotate in the live pricing card on the hero section."
          slots={hero}
          slotCount={HERO_SLOTS}
          products={products ?? []}
          productMap={productMap}
          onChange={updateHero}
        />

        <SlotSection
          title="Live Pricing — No Login"
          description="Six products shown in the Live Pricing grid below the fold."
          slots={featured}
          slotCount={FEATURED_SLOTS}
          products={products ?? []}
          productMap={productMap}
          onChange={updateFeatured}
        />
      </div>
    </PageTransition>
  )
}

function padSlots(ids: string[], count: number): (string | null)[] {
  const next: (string | null)[] = Array(count).fill(null)
  ids.slice(0, count).forEach((id, i) => {
    next[i] = id
  })
  return next
}

interface SlotProduct {
  id: string
  name: string
  price: number
  unit: string
}

interface SlotSectionProps {
  title: string
  description: string
  slots: (string | null)[]
  slotCount: number
  products: { id: string; name: string; price: number; unit: string }[]
  productMap: Map<string, SlotProduct>
  onChange: (index: number, value: string | null) => void
}

function SlotSection({
  title,
  description,
  slots,
  slotCount,
  products,
  productMap,
  onChange,
}: SlotSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: slotCount }).map((_, index) => {
            const value = slots[index]
            const selectedInThisSection = new Set(
              slots.filter((id, i) => id && i !== index) as string[],
            )
            const selected = value ? productMap.get(value) : null

            return (
              <div
                key={index}
                className="rounded-xl border border-border/60 bg-background/40 p-4"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Slot {index + 1}
                </p>
                <Select
                  value={value ?? NONE_VALUE}
                  onValueChange={(next) =>
                    onChange(index, next === NONE_VALUE ? null : next)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>— Empty —</SelectItem>
                    {products.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        disabled={selectedInThisSection.has(p.id)}
                      >
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    AUD {selected.price.toFixed(2)} /{selected.unit}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
