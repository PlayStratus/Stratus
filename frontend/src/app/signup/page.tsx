"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signupAction } from "./actions"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

export default function SignUp() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const result = await signupAction(formData)

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

        <form
          onSubmit={handleSignUp}
          className='w-full max-w-md bg-card p-8 rounded-lg border'
        >
          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}

          <div className='mb-4 text-left'>
            <Label
              htmlFor='email'
              className='block text-sm font-medium text-foreground mb-2'
            >
              Oregon State Email
            </Label>

            <Input
              type='email'
              id='email'
              name='email'
              placeholder='odin@oregonstate.edu'
              className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2'
              required
            />
          </div>

          <div className='mb-4 text-left'>
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
              placeholder='Username'
              className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2'
              required
            />
          </div>

          <Button
            type='submit'
            className='w-full py-2 rounded-lg'
            disabled={isLoading}
          >
            {isLoading ? "Signing Up..." : "Sign Up"}
          </Button>

          <div className='mt-4 text-center text-sm text-muted-foreground'>
            Already have an account?{" "}
            <Link href='/login' className='text-foreground hover:underline'>
              Log In
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}
