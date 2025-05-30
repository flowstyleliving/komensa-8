import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { Providers } from '@/lib/providers'
import { Suspense } from "react"

export const metadata: Metadata = {
  title: {
    default: "Komensa - AI-Powered Communication for Stronger Relationships",
    template: "%s | Komensa",
  },
  description:
    "Transform your conversations with AI-guided communication. Komensa helps couples resolve conflicts, improve understanding, and build stronger relationships through structured dialogue.",
  keywords: [
    "relationship communication",
    "AI mediation",
    "couple therapy",
    "conflict resolution",
    "relationship counseling",
    "communication tools",
    "relationship app",
  ],
  authors: [{ name: "Komensa Team" }],
  creator: "Komensa",
  publisher: "Komensa",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://komensa.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://komensa.app",
    title: "Komensa - AI-Powered Communication for Stronger Relationships",
    description:
      "Transform your conversations with AI-guided communication. Help couples resolve conflicts and build stronger relationships.",
    siteName: "Komensa",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Komensa - Better conversations, stronger relationships",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Komensa - AI-Powered Communication for Stronger Relationships",
    description:
      "Transform your conversations with AI-guided communication. Help couples resolve conflicts and build stronger relationships.",
    images: ["/images/og-image.png"],
    creator: "@komensa",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D8A7B1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Komensa" />
      </head>
      <body className="font-sans antialiased bg-[#F9F7F4] text-[#3C4858] min-h-screen">
        <div className="relative flex min-h-screen flex-col">
          <main className="flex-1">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
    </Suspense>
  )
}
