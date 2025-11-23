import {
  getGoogleUser,
  verifyAccessToken,
  refreshAccessToken,
} from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getBackendPath } from "@/lib/backend/getBackendPath"

async function handleSetUsername(formData: FormData) {
  "use server"

  const username = formData.get("username") as string

  if (!username) {
    return
  }

  // Get the access token from cookies
  const cookieStore = await cookies()
  const auth_token = cookieStore.get("auth_token")?.value

  if (!auth_token) {
    redirect("/signin?error=No authentication token found")
  }

  // Only wrap the network call in try/catch. Avoid catching the special
  // Next.js redirect exception (NEXT_REDIRECT) by performing redirects
  // outside of the try/catch so they aren't swallowed and treated as errors.
  let response: Response | undefined
  try {
    response = await fetch(getBackendPath("/users/create"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth_token}`,
      },
      body: JSON.stringify({ username }),
    })
  } catch (error) {
    console.error("Network error creating user:", error)
    redirect(
      `/signin?error=${encodeURIComponent(
        "Failed to set username. Please try again."
      )}`
    )
  }

  if (!response || !response.ok) {
    try {
      const errorData = await response?.json()
      console.error("Error creating user:", errorData)
    } catch (e) {
      // ignore JSON parse errors
    }

    redirect(
      `/signin?error=${encodeURIComponent(
        "Failed to set username. Please try again."
      )}`
    )
  }

  // Successful - perform the redirect outside the try/catch above.
  redirect("/browse")
}

export default async function SetUsernamePage() {
  const cookieStore = await cookies()
  const auth_token = cookieStore.get("auth_token")?.value

  if (!auth_token) {
    redirect("/signin?error=No authentication token found")
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

          <form action={handleSetUsername}>
            <Input
              id='username'
              name='username'
              type='text'
              placeholder='Username'
              className='w-full mb-4'
              required
            />

            <Button type='submit' className='w-full'>
              Set Username
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
