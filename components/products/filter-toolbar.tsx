"use client"

import { Filter, Package, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SortOption = "price-asc" | "price-desc" | "name-asc" | "name-desc"

interface FilterToolbarProps {
  categories: string[]
  regions: string[]
  selectedCategory: string
  selectedRegion: string
  sortBy: SortOption
  inStockOnly: boolean
  onCategoryChange: (value: string) => void
  onRegionChange: (value: string) => void
  onSortChange: (value: SortOption) => void
  onStockToggle: () => void
}

export function FilterToolbar({
  categories,
  regions,
  selectedCategory,
  selectedRegion,
  sortBy,
  inStockOnly,
  onCategoryChange,
  onRegionChange,
  onSortChange,
  onStockToggle,
}: FilterToolbarProps) {
  return (
    <div className="sticky top-16 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Category chips — horizontal scrollable */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-4 scrollbar-none sm:pb-4 sm:pt-5">
          <SlidersHorizontal className="mr-1 size-4 shrink-0 text-muted-foreground" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`inline-flex shrink-0 cursor-pointer items-center rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "border border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <Select value={selectedRegion} onValueChange={onRegionChange}>
              <SelectTrigger className="h-8 w-36 rounded-lg border-border/60 text-xs font-medium">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region} value={region} className="text-xs">
                    {region === "All" ? "All Regions" : region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select
            value={sortBy}
            onValueChange={(v) => onSortChange(v as SortOption)}
          >
            <SelectTrigger className="h-8 w-44 rounded-lg border-border/60 text-xs font-medium">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc" className="text-xs">
                Price: Low → High
              </SelectItem>
              <SelectItem value="price-desc" className="text-xs">
                Price: High → Low
              </SelectItem>
              <SelectItem value="name-asc" className="text-xs">
                Name A → Z
              </SelectItem>
              <SelectItem value="name-desc" className="text-xs">
                Name Z → A
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={inStockOnly ? "default" : "outline"}
            size="sm"
            onClick={onStockToggle}
            className="h-8 rounded-lg text-xs font-medium"
          >
            <Package className="mr-1.5 size-3" />
            In Stock Only
          </Button>
        </div>
      </div>
    </div>
  )
}
