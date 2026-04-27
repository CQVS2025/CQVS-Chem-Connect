import type { Metadata } from "next"
import { Geist_Mono, Roboto } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/lib/providers"
import { cn } from "@/lib/utils"
import { ClarityScript } from "@/components/analytics/clarity-script"
import { JsonLd } from "@/components/seo/json-ld"
import { organizationSchema, websiteSchema } from "@/lib/seo/schema"

const roboto = Roboto({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Chem Connect - B2B Industrial Chemical Marketplace Australia",
    template: "%s · Chem Connect",
  },
  description:
    "Buy industrial chemicals direct from Australian manufacturers. Bulk pricing in AUD, GST registered, fast freight from VIC, NSW, QLD, SA, WA.",
  applicationName: "Chem Connect",
  keywords: [
    "industrial chemicals Australia",
    "B2B chemical marketplace",
    "bulk chemicals supplier",
    "Australian chemical distributor",
    "buy industrial chemicals online",
  ],
  alternates: {
    canonical: "/",
    // hreflang tells Google this is the Australian-English version of
    // the page. x-default points crawlers without a regional preference
    // at the same URL - there's no other locale variant to fall back to.
    languages: {
      "en-AU": "/",
      "x-default": "/",
    },
  },
  icons: {
    icon: "/images/cqvs-logo.png",
    apple: "/images/cqvs-logo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Chem Connect",
    locale: "en_AU",
    url: SITE_URL,
    title: "Chem Connect - B2B Industrial Chemical Marketplace Australia",
    description:
      "Buy industrial chemicals direct from Australian manufacturers. Bulk pricing in AUD, GST registered, fast freight from VIC, NSW, QLD, SA, WA.",
    images: [
      {
        url: "/images/cqvs-logo.png",
        width: 1200,
        height: 630,
        alt: "Chem Connect - B2B Chemical Marketplace Australia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chem Connect - B2B Industrial Chemical Marketplace Australia",
    description:
      "Buy industrial chemicals direct from Australian manufacturers. Bulk pricing in AUD, GST registered, fast freight from VIC, NSW, QLD, SA, WA.",
    images: ["/images/cqvs-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Search-engine verification tokens. Set via env vars (not committed):
  //   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION   - token from Search Console
  //   NEXT_PUBLIC_BING_SITE_VERIFICATION     - content from Bing Webmaster
  //   NEXT_PUBLIC_YANDEX_SITE_VERIFICATION   - optional, Yandex
  // Once added to .env and re-deployed, both consoles can verify the
  // domain instantly via the meta-tag method (no DNS access needed).
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ?? "",
    },
    yandex: process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-AU"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn("antialiased", fontMono.variable, "font-sans", roboto.variable)}
    >
      <body suppressHydrationWarning>
        <JsonLd schema={organizationSchema(SITE_URL)} id="ld-organization" />
        <JsonLd schema={websiteSchema(SITE_URL)} id="ld-website" />
        {/* Microsoft Clarity - heatmaps + session recordings + insights.
            Env-gated; renders nothing if NEXT_PUBLIC_CLARITY_PROJECT_ID is
            unset, so local dev and staging stay out of production data. */}
        <ClarityScript />
        <ThemeProvider defaultTheme="dark">
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
