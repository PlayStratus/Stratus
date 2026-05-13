"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "./AuthProvider"

export default function ProtectedShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin")
    }

    if (status === "needs-username" && pathname !== "/signin/username") {
      router.replace("/signin/username")
    }
  }, [pathname, router, status])

  if (status === "loading") {
    return (
      <main className='flex flex-1 items-center justify-center'>
        <p className='text-sm text-muted-foreground'>Checking session...</p>
      </main>
    )
  }

  if (status !== "authenticated") {
    return null
  }

  return <>{children}</>
}
