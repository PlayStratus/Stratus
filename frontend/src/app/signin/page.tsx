import { GoogleOAuthProvider } from "@react-oauth/google"
import type { Metadata } from "next"

import Nav from "@/components/Nav"

import SignInPageClient from "./SignInPageClient"

export const metadata: Metadata = {
  title: "Sign In",
}

type Props = {
  searchParams: Promise<{ error?: string }>
}

async function SignInPageContent({ searchParams }: Props) {
  const params = await searchParams
  const error = params.error ? decodeURIComponent(params.error) : null

  return <SignInPageClient error={error} />
}

export default function SignInPage({ searchParams }: Props) {
  return (
    <GoogleOAuthProvider clientId={process.env.GOOGLE_CLIENT_ID || ""}>
      <div className='flex min-h-0 flex-1 flex-col'>
        <Nav hideSearchBar />
        <SignInPageContent searchParams={searchParams} />
      </div>
    </GoogleOAuthProvider>
  )
}
