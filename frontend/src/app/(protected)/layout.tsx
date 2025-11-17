import Nav from "@/components/Nav"
import { getBackendPath } from "@/lib/backend/getBackendPath"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

async function verifyAuth() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get("access_token")
  const refreshToken = cookieStore.get("refresh_token")

  if (!refreshToken) {
    redirect("/login")
  }

  if (!accessToken) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      redirect("/login")
    }
    return { valid: true }
  }

  try {
    const response = await fetch(getBackendPath("/users/verify"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
      },
      cache: "no-store",
    })

    const data = await response.json()

    if (!response.ok || !data.valid) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        redirect("/login")
      }
      return { valid: true }
    }

    return data
  } catch (error) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      redirect("/login")
    }
    return { valid: true }
  }
}

async function refreshAccessToken() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get("refresh_token")

    if (!refreshToken) {
      return false
    }

    const response = await fetch(getBackendPath("/users/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refresh_token=${refreshToken.value}`,
      },
      credentials: "include",
      cache: "no-store",
    })

    if (!response.ok) {
      return false
    }

    const setCookieHeader = response.headers.get("set-cookie")
    if (setCookieHeader) {
      const match = setCookieHeader.match(/access_token=([^;]+)/)
      if (match) {
        const newAccessToken = match[1]
        cookieStore.set("access_token", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 24 * 60 * 60, // 24 hours
        })
      }
    }

    return true
  } catch (error) {
    console.error("Token refresh error:", error)
    return false
  }
}

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await verifyAuth()

  return (
    <>
      <Nav />

      {children}

      <footer className='px-4 py-20 bg-muted/30'>
        <div className='container mx-auto'>
          <h2 className='text-3xl md:text-5xl font-bold mb-6'>Stratus</h2>
        </div>
      </footer>
    </>
  )
}
