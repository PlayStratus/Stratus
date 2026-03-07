import type { Metadata } from "next"
import { Geist, Inclusive_Sans } from "next/font/google"
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
  description: "[Description]", // TODO: Add description
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' className = 'dark'>
      <body
        className={`${geistSans.variable} ${inclusiveSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
