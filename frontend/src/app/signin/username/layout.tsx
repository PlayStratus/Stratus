import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Set Username",
}

export default function UsernameLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
