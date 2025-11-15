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

async function handleSetUsername(formData: FormData) {
  "use server"

  const username = formData.get("username") as string

  if (!username) {
    return
  }

  // Get the access token from cookies
  const cookieStore = await cookies()
  const access_token = cookieStore.get("access_token")?.value

  if (!access_token) {
    redirect("/signin?error=No authentication token found")
  }

  try {
    const { id } = await getGoogleUser(access_token)

    console.log("Username:", username)
    console.log("User ID:", id)

    // TODO: Send user ID and username to backend to create/update user
    // const response = await fetch(`${backendUrl}/users`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ id, username })
    // })

    redirect("/browse")
  } catch (error) {
    console.error("Failed to get user info:", error)
    redirect("/signin?error=Failed to verify user information")
  }
}

export default async function SetUsernamePage() {
  const cookieStore = await cookies()
  const access_token = cookieStore.get("access_token")?.value
  const refresh_token = cookieStore.get("refresh_token")?.value
  const token_expiry = cookieStore.get("token_expiry")?.value

  if (!access_token || !refresh_token || !token_expiry) {
    redirect("/signin?error=No authentication token found")
  }

  const isExpired = token_expiry && parseInt(token_expiry) < Date.now()

  if (isExpired && refresh_token) {
    try {
      const newAccessToken = await refreshAccessToken(refresh_token)

      const isProduction = process.env.NODE_ENV === "production"
      cookieStore.set("access_token", newAccessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 3599, // 1 hour
        path: "/",
      })

      const newExpiry = Date.now() + 3599 * 1000
      cookieStore.set("token_expiry", newExpiry.toString(), {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      })
    } catch (error) {
      console.error("Token refresh failed:", error)
      redirect("/signin?error=Session expired. Please sign in again")
    }
  }

  const isValid = await verifyAccessToken(access_token)
  if (!isValid) {
    redirect("/signin?error=Invalid authentication token")
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
