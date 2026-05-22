import type { Metadata } from "next"
import { Suspense } from "react"
import { Geist, Inclusive_Sans } from "next/font/google"

import { AuthProvider } from "@/components/auth/AuthProvider"
import ConditionalFooter from "@/components/Footer/ConditionalFooter"
import { isStaticExport } from "@/lib/static-export"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const inclusiveSans = Inclusive_Sans({
  variable: "--font-inclusive-sans",
  subsets: ["latin"],
})

const DESCRIPTION =
  "Stratus is a low-latency game streaming service that enables users to play games directly from their web browser."

export const metadata: Metadata = {
  metadataBase: new URL("https://www.playstratus.io"),
  title: "Stratus",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: "/",
    title: "Stratus",
    description: DESCRIPTION,
    images: "/opengraph.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const content = (
    <>
      <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
      <Suspense fallback={null}>
        <ConditionalFooter />
      </Suspense>
    </>
  )

  return (
    <html lang='en' className='dark'>
      <body
        className={`${geistSans.variable} ${inclusiveSans.variable} antialiased min-h-screen flex flex-col`}
      >
        {isStaticExport ? content : <AuthProvider>{content}</AuthProvider>}
      </body>
    </html>
  )
}
