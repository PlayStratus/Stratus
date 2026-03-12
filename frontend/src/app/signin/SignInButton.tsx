"use client"

import { GoogleLogin } from "@react-oauth/google"
import { useRouter } from "next/navigation"

import { getBackendPath } from "@/lib/backend/getBackendPath"

export default function SignInButton() {
  const router = useRouter()

  const handleSuccess = async (credentialResponse: any) => {
    try {
      const res = await fetch(getBackendPath("/auth/google"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      })

      const data = await res.json()

      if (res.status === 403) {
        router.push("/signin/username")
        router.refresh()
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "Login failed")
      }

      router.push("/browse")
      router.refresh()
    } catch (err) {
      console.error("Login failed:", err)
      const message =
        err instanceof Error ? err.message : "Google sign-in failed"
      router.push(`/signin?error=${encodeURIComponent(message)}`)
    }
  }

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.log("Google Login Failed")}
    />
  )
}
