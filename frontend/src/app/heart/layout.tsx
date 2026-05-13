import type { Metadata } from "next"

import Nav from "@/components/Nav"

export const metadata: Metadata = {
  title: "Node Heartbeats",
}

export default function HeartLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <Nav hideSearchBar />

      {children}
    </>
  )
}
