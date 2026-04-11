import { FadeIn } from "@/components/shared/motion"

const partners = [
  "TNT Express",
  "Aramex",
  "Hi Trans",
  "Followmont",
  "Xero",
  "Stripe",
]

export function LogoBar() {
  return (
    <section className="border-y border-border/60 bg-card/30 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trusted infrastructure powering Chem Connect
          </p>
          <div className="mt-7 grid grid-cols-3 items-center gap-x-6 gap-y-5 sm:grid-cols-6">
            {partners.map((partner) => (
              <div
                key={partner}
                className="flex items-center justify-center text-base font-bold tracking-tight text-muted-foreground/70 transition-colors duration-200 hover:text-foreground sm:text-lg"
              >
                {partner}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
