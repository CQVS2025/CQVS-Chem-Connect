import { FadeIn } from "@/components/shared/motion"

const stats = [
  {
    value: "$45M+",
    label: "Chemicals quoted through Chem Connect",
  },
  {
    value: "2-5",
    suffix: "days",
    label: "Delivery from local manufacturers",
  },
  {
    value: "60s",
    label: "Average order time end-to-end",
  },
  {
    value: "200+",
    label: "AU plants actively buying",
  },
]

export function NumbersStrip() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="grid grid-cols-2 gap-y-10 sm:gap-y-0 lg:grid-cols-4">
            {stats.map((stat, idx) => (
              <div
                key={stat.label}
                className={`flex flex-col items-center text-center sm:items-start sm:text-left lg:px-8 ${
                  idx > 0 ? "lg:border-l lg:border-border/60" : ""
                }`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    {stat.value}
                  </span>
                  {stat.suffix && (
                    <span className="text-base font-semibold text-muted-foreground">
                      {stat.suffix}
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-[16ch] text-sm leading-snug text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
