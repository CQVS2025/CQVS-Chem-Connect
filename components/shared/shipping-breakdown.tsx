import { Truck } from "lucide-react"

interface ShippingBreakdownProps {
  shipping: number
  breakdown: {
    base_rate: number
    fuel_levy: number
    fuel_levy_percent: number
    tax: number
    tax_percent: number
    before_tax: number
    tailgate_applied: boolean
    tailgate_amount: number
    tailgate_name: string | null
    other_surcharges: Array<{ name: string; amount: number }>
    total: number
  } | null
  serviceName?: string | null
  carrierName?: string | null
  pickupDate?: string | null
  etaDate?: string | null
  etaBizDays?: number | null
  formatCurrency?: (v: number) => string
}

const defaultFormat = (v: number) =>
  `AUD ${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function ShippingBreakdown({
  shipping,
  breakdown,
  serviceName,
  carrierName,
  pickupDate,
  etaDate,
  etaBizDays,
  formatCurrency = defaultFormat,
}: ShippingBreakdownProps) {
  return (
    <div className="space-y-1">
      {/* Total shipping line */}
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Truck className="h-3.5 w-3.5" />
          Shipping
        </span>
        <span className="font-medium">
          {shipping > 0 ? formatCurrency(shipping) : "Free"}
        </span>
      </div>

      {/* Breakdown (if available) */}
      {breakdown && shipping > 0 && (
        <div className="ml-3 space-y-0.5 border-l-2 border-border/50 pl-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Base freight</span>
            <span>{formatCurrency(breakdown.base_rate)}</span>
          </div>
          {breakdown.fuel_levy > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Fuel levy ({breakdown.fuel_levy_percent.toFixed(1)}%)
              </span>
              <span>{formatCurrency(breakdown.fuel_levy)}</span>
            </div>
          )}
          {breakdown.tailgate_applied && breakdown.tailgate_amount > 0 && (
            <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
              <span>
                {breakdown.tailgate_name ?? "Tailgate surcharge"}
              </span>
              <span>{formatCurrency(breakdown.tailgate_amount)}</span>
            </div>
          )}
          {breakdown.other_surcharges.map((s) => (
            <div
              key={s.name}
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span>{s.name}</span>
              <span>{formatCurrency(s.amount)}</span>
            </div>
          ))}
          {breakdown.tax > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Shipping GST ({breakdown.tax_percent}%)</span>
              <span>{formatCurrency(breakdown.tax)}</span>
            </div>
          )}
        </div>
      )}

      {/* Carrier + service */}
      {carrierName && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Carrier</span>
          <span>
            {carrierName}
            {serviceName ? ` - ${serviceName}` : ""}
          </span>
        </div>
      )}

      {/* Dates */}
      {pickupDate && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Est. dispatch</span>
          <span>
            {new Date(pickupDate).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      )}
      {etaDate && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Est. delivery</span>
          <span>
            {new Date(etaDate).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "short",
            })}
            {etaBizDays != null ? ` (${etaBizDays}d)` : ""}
          </span>
        </div>
      )}
    </div>
  )
}
