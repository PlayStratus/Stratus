"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/AuthProvider"

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
      <main className='flex min-h-screen items-center justify-center'>
        <p className='text-sm text-muted-foreground'>Checking session...</p>
      </main>
    )
  }

  if (status !== "needs-username") {
    return null
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
            Set your username
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              id='username'
              name='username'
              type='text'
              placeholder='Username'
              className='w-full mb-4'
              required
            />

            {error && (
              <div className='mb-4 rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm text-red-500'>
                {error}
              </div>
            )}

            <Button type='submit' className='w-full'>
              {isSubmitting ? "Saving..." : "Set Username"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
