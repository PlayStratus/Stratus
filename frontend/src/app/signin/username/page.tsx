"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/AuthProvider"
import NavClient from "@/components/Nav/NavClient"

export default function SetUsernamePage() {
  const router = useRouter()
  const { createUsername, status } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin?error=No authentication token found")
    }

    if (status === "authenticated") {
      router.replace("/browse")
    }
  }, [router, status])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const username = formData.get("username")?.toString().trim()

    if (!username) {
      setError("Username is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createUsername(username)
      router.push("/browse")
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to set username. Please try again."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading") {
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <NavClient games={[]} hideSearchBar />
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
      </div>
    )
  }

  if (status !== "needs-username") {
    return null
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <NavClient games={[]} hideSearchBar />
      <main className='relative flex min-h-0 flex-1 items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-4 py-12 sm:px-6 sm:py-16 lg:px-8'>
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

        <div className='mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]'>
          <section className='flex flex-col items-center text-center lg:items-start lg:text-left'>
            <h1 className='max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl'>
              Your OSU account is signed in.
            </h1>

            <p className='mt-5 max-w-lg text-lg font-medium leading-relaxed text-muted-foreground md:text-2xl'>
              Finish setup by choosing a Stratus username for your Oregon State
              student account.
            </p>
          </section>

          <section className='w-full'>
            <div className='mx-auto w-full max-w-md rounded-xl border border-border/70 bg-card/85 p-5 shadow-xl shadow-blue-400/25 backdrop-blur md:p-8'>
              <div className='mb-6 flex items-start gap-4'>
                <h2 className='mt-1 text-3xl font-bold tracking-tight'>
                  Set your username
                </h2>
              </div>

              <form onSubmit={handleSubmit} className='space-y-4'>
                <Input
                  id='username'
                  name='username'
                  type='text'
                  placeholder='Username'
                  className='h-11 border-border/70 bg-background/45'
                  required
                />

                {error && (
                  <div className='rounded-lg border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-200'>
                    {error}
                  </div>
                )}

                <Button
                  type='submit'
                  className='h-11 w-full shadow-md shadow-blue-400/10'
                >
                  {isSubmitting && (
                    <LoaderCircle className='h-4 w-4 animate-spin' />
                  )}
                  {isSubmitting ? "Saving..." : "Set Username"}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
