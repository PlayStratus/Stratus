"use client"

import { usePathname, useSearchParams } from "next/navigation"

import Footer from "."

export default function ConditionalFooter() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const normalizedPathname =
    pathname === "/" ? pathname : pathname.replace(/\/$/, "")

  const isConnectedDirectConnect =
    normalizedPathname === "/direct-connect" &&
    Boolean(searchParams.get("url")) &&
    Boolean(searchParams.get("tls_cert")) &&
    !searchParams.get("error")

  if (isConnectedDirectConnect) {
    return null
  }

  return (
    <Footer
      logoLoading={normalizedPathname.startsWith("/browse") ? "eager" : "lazy"}
    />
  )
}
