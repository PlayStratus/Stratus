"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"

import SignInButton from "./SignInButton"

type SignInPageClientProps = {
  error: string | null
}

function SessionStatus() {
  return (
    <main className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background px-4'>
      <video
        autoPlay
        loop
        muted
        playsInline
        className='pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-40'
      >
        <source src='/gradient.mp4' type='video/mp4' />
      </video>

      <div className='rounded-lg border border-border/70 bg-card/80 px-5 py-4 text-center shadow-lg shadow-blue-400/15 backdrop-blur'>
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
    <main className='relative flex min-h-0 flex-1 items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-10 sm:px-6 lg:px-8'>
      <video
        autoPlay
        loop
        muted
        playsInline
        className='pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-60'
      >
        <source src='/gradient.mp4' type='video/mp4' />
      </video>
      <div className='pointer-events-none absolute inset-0 -z-10 bg-background/25' />

      <div className='mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_0.92fr]'>
        <section className='flex flex-col items-center text-center lg:items-start lg:text-left'>
          <h1 className='max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl'>
            Stratus is currently available to Oregon State University students
          </h1>

          <p className='mt-5 max-w-2xl text-lg font-medium leading-relaxed text-muted-foreground md:text-xl'>
            Sign in with your oregonstate.edu email to continue
          </p>
        </section>

        <section className='w-full'>
          <div className='mx-auto w-full max-w-md rounded-xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-blue-400/25 backdrop-blur md:p-8'>
            <div className='mb-6'>
              <h1 className='mt-2 text-3xl font-bold tracking-tight md:text-4xl'>
                Sign In
              </h1>
            </div>

            <SignInButton />

            {error && (
              <div className='mt-5 rounded-lg border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-200'>
                {error}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
