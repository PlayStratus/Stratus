"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { useAuth } from "@/components/auth/AuthProvider"

import SignInButton from "./SignInButton"

type SignInPageClientProps = {
  error: string | null
}

function SessionStatus() {
  return (
    <main className='flex min-h-screen items-center justify-center bg-linear-to-b from-background via-background to-muted/20 px-4'>
      <div className='text-center'>
        <p className='text-sm text-muted-foreground'>Checking session...</p>
      </div>
    </main>
  )
}

export default function SignInPageClient({
  error,
}: Readonly<SignInPageClientProps>) {
  const router = useRouter()
  const { status } = useAuth()

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/browse")
    }

    if (status === "needs-username") {
      router.replace("/signin/username")
    }
  }, [router, status])

  if (status !== "unauthenticated") {
    return <SessionStatus />
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background to-muted/20'>
      <div className='flex flex-col items-center justify-center space-y-8 px-4 py-16 text-center max-w-2xl w-full'>
        <Link
          href='/'
          className='self-start flex items-center gap-2 text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='w-5 h-5' />
          <span>Back to Home</span>
        </Link>

        <h1 className='text-4xl md:text-5xl font-extrabold tracking-tight'>
          Stratus
        </h1>

        <div className='w-full max-w-md bg-card p-8 rounded-lg border'>
          <div className='mb-4 p-3 border rounded-lg text-sm'>
            Sign in with your oregonstate.edu email address.
          </div>

          <SignInButton />

          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
