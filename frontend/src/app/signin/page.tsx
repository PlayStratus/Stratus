import { GoogleOAuthProvider } from "@react-oauth/google"
import type { Metadata } from "next"

import Nav from "@/components/Nav"
import { isStaticExport } from "@/lib/static-export"

import SignInPageClient from "./SignInPageClient"

export const metadata: Metadata = {
  title: "Sign In",
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

async function SignInPageContent({ searchParams }: Props) {
  const { error } = await searchParams

  return <SignInPageClient error={error ?? null} />
}

export default function SignInPage({ searchParams }: Props) {
  if (isStaticExport) {
    return null
  }

  return (
    <GoogleOAuthProvider clientId={process.env.GOOGLE_CLIENT_ID || ""}>
      <div className='flex min-h-0 flex-1 flex-col'>
        <Nav hideSearchBar />
        <SignInPageContent searchParams={searchParams} />
      </div>
    </GoogleOAuthProvider>
  )
}
