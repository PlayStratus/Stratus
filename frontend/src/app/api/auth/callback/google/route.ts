import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getGoogleTokens, getGoogleUser } from "@/lib/auth"
import { getBackendPath } from "@/lib/backend/getBackendPath"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "Google sign-in was cancelled or failed"
        )}`,
        request.url
      )
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=No authorization code received", request.url)
    )
  }

  try {
    const tokens = await getGoogleTokens(code)

    const googleUser = await getGoogleUser(tokens.access_token)

    // TODO: Send user info to backend to handle login/signup
    console.log(googleUser)

    return NextResponse.redirect(new URL("/browse", request.url))
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed"
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}
