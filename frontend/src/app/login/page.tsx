"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginAction } from "./actions"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"

function LoginContent() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await loginAction(formData)

      if (result?.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
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
          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}
          <Button
            type='button'
            variant='outline'
            className='w-full py-2 rounded-lg flex items-center justify-center gap-2'
            onClick={() => {
              setIsLoading(true)
              window.location.href = "/api/auth/google"
            }}
            disabled={isLoading}
          >
            <svg
              className='w-5 h-5'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                fill='#4285F4'
              />
              <path
                d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                fill='#34A853'
              />
              <path
                d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                fill='#FBBC05'
              />
              <path
                d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                fill='#EA4335'
              />
            </svg>
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </Button>

          <div className='mt-4 text-center text-sm text-muted-foreground'>
            Don't have an account?{" "}
            <Link href='/signup' className='text-foreground hover:underline'>
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LogIn() {
  return (
    <Suspense
      fallback={
        <main className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background to-muted/20'>
          <div className='flex flex-col items-center justify-center space-y-8 px-4 py-16 text-center max-w-2xl w-full'>
            <h1 className='text-4xl md:text-5xl font-extrabold tracking-tight'>
              Stratus
            </h1>
          </div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
