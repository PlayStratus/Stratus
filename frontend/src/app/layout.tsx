import type { Metadata } from "next"
import { Geist, Inclusive_Sans } from "next/font/google"

import { AuthProvider } from "@/components/auth/AuthProvider"

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
        className={`${geistSans.variable} ${inclusiveSans.variable} antialiased`}
      >
        <AuthProvider>
          {children}

          <footer className='px-4 py-20 bg-muted/30'>
            <div className='container mx-auto'>
              <h2 className='text-3xl md:text-5xl font-bold mb-6'>Stratus</h2>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
