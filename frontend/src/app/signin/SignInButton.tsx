"use client"

import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"

export default function SignInButton() {
  const router = useRouter()
  const { signInWithGoogle } = useAuth()

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      if (!credentialResponse.credential) {
        throw new Error("Google sign-in did not return a credential")
      }

      const result = await signInWithGoogle(credentialResponse.credential)

      if (result.needsUsername) {
        router.push("/signin/username")
        return
      }

      router.push("/browse")
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
      onError={() =>
        router.push(
          `/signin?error=${encodeURIComponent("Google sign-in failed")}`,
        )
      }
    />
  )
}
