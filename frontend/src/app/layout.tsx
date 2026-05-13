import type { Metadata } from "next"
import { Suspense } from "react"
import { Geist, Inclusive_Sans } from "next/font/google"

import { AuthProvider } from "@/components/auth/AuthProvider"
import ConditionalFooter from "@/components/Footer/ConditionalFooter"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const inclusiveSans = Inclusive_Sans({
  variable: "--font-inclusive-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Stratus",
  description:
    "Stratus is a game streaming service that enables users to play games directly from their web browser, similarly to services such as Google Stadia, Nvidia GeForce NOW, and Amazon Luna.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' className='dark'>
      <body
        className={`${geistSans.variable} ${inclusiveSans.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
          <Suspense fallback={null}>
            <ConditionalFooter />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  )
}
