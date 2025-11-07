"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBackendPath } from "@/lib/backend/getBackendPath"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LogIn() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const username = formData.get("username") as string

    try {
      const response = await fetch(getBackendPath("/users/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      router.push("/browse")
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

        <form
          onSubmit={handleLogin}
          className='w-full max-w-md bg-card p-8 rounded-lg border'
        >
          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}

          <div className='mb-6 text-left'>
            <Label
              htmlFor='username'
              className='block text-sm font-medium text-foreground mb-2'
            >
              Username
            </Label>

            <Input
              type='text'
              id='username'
              name='username'
              placeholder='username'
              className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2'
              required
            />
          </div>

          <Button
            type='submit'
            className='w-full py-2 rounded-lg'
            disabled={isLoading}
          >
            {isLoading ? "Logging In..." : "Log In"}
          </Button>

          <div className='mt-4 text-center text-sm text-muted-foreground'>
            Don't have an account?{" "}
            <Link href='/signup' className='text-foreground hover:underline'>
              Sign Up
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
