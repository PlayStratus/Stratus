"use client"

import { useRef, useState } from "react"
import { CredentialResponse, GoogleLogin } from "@react-oauth/google"
import { LoaderCircle } from "lucide-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"

export default function SignInButton() {
  const router = useRouter()
  const { signInWithGoogle } = useAuth()
  const isSubmittingRef = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    if (isSubmittingRef.current) {
      return
    }

    try {
      if (!credentialResponse.credential) {
        throw new Error("Google sign-in did not return a credential")
      }

      isSubmittingRef.current = true
      setIsSubmitting(true)

      const result = await signInWithGoogle(credentialResponse.credential)

      if (result.needsUsername) {
        router.replace("/signin/username")
        return
      }

      router.replace("/browse")
    } catch (err) {
      isSubmittingRef.current = false
      setIsSubmitting(false)
      console.error("Login failed:", err)
      const message =
        err instanceof Error ? err.message : "Google sign-in failed"
      router.replace(`/signin?error=${encodeURIComponent(message)}`)
    }
  }

  if (isSubmitting) {
    return (
      <Button
        type='button'
        variant='outline'
        className='h-11 w-full justify-center border-border/70 bg-background/60 text-foreground'
        disabled
      >
        <LoaderCircle className='h-4 w-4 animate-spin' />
        Signing you in...
      </Button>
    )
  }

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      theme='outline'
      size='medium'
      text='signin_with'
      shape='rectangular'
      logo_alignment='left'
      width='196'
      containerProps={{
        className: "flex w-full justify-center",
      }}
      onError={() =>
        router.replace(
          `/signin?error=${encodeURIComponent("Google sign-in failed")}`,
        )
      }
    />
  )
}
