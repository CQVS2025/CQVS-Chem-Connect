import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ProductCardProps {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  manufacturer: string
  classification: string
  inStock: boolean
  packagingSizes: string[]
  badge: string | null
  image: string
}

export function ProductCard({
  name,
  slug,
  price,
  unit,
  manufacturer,
  classification,
  inStock,
  packagingSizes,
  badge,
  image,
}: ProductCardProps) {
  return (
    <Link href={`/products/${slug}`} className="group block h-full">
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
        {/* Image */}
        <div className="relative aspect-[5/4] overflow-hidden bg-white">
          <Image
            src={image || "/images/cqvs-logo.png"}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />

          {/* Floating price tag */}
          <div className="absolute right-3 top-3 rounded-xl border border-border/80 bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
            <span className="text-sm font-bold text-foreground">
              AUD {price.toFixed(2)}
            </span>
            <span className="ml-0.5 text-xs text-muted-foreground">
              / {unit}
            </span>
          </div>

          {/* Badge */}
          {badge && (
            <span
              className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-md ${
                badge === "Best Seller"
                  ? "bg-emerald-500 text-emerald-950"
                  : badge === "Coming Soon"
                    ? "bg-amber-400 text-amber-950"
                    : badge.startsWith("DG")
                      ? "bg-rose-500 text-rose-950"
                      : "bg-sky-500 text-sky-950"
              }`}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{manufacturer}</p>

          {/* Badges row */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={classification === "Non-DG" ? "secondary" : "destructive"}
              className="text-[10px]"
            >
              {classification}
            </Badge>
            {inStock ? (
              <Badge className="gap-1 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-2.5" />
                In Stock
              </Badge>
            ) : (
              <Badge className="bg-red-500/10 text-[10px] text-red-600 dark:text-red-400">
                Out of Stock
              </Badge>
            )}
          </div>

          {/* Packaging sizes */}
          {packagingSizes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {packagingSizes.map((size) => (
                <span
                  key={size}
                  className="rounded-md border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {size}
                </span>
              ))}
            </div>
          )}

          {/* Spacer + CTA */}
          <div className="mt-auto flex items-center justify-end pt-4">
            <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
              View details
              <ArrowRight className="size-3" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
