import { GoogleOAuthProvider } from "@react-oauth/google"
import SignInPageClient from "./SignInPageClient"

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
      <SignInPageContent searchParams={searchParams} />
    </GoogleOAuthProvider>
  )
}
