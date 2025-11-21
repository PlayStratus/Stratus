import { NextRequest, NextResponse } from "next/server"
import { getGoogleTokens, getGoogleUser } from "@/lib/auth"
import { getBackendPath } from "@/lib/backend/getBackendPath"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/signin?error=${encodeURIComponent(
          "Google sign-in was cancelled or failed"
        )}`,
        request.url
      )
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/signin?error=No authorization code received", request.url)
    )
  }

  try {
    const tokens = await getGoogleTokens(code)

    if (!tokens.access_token) {
      throw new Error("No access token received from Google")
    }

    const { id, email } = await getGoogleUser(tokens.access_token)

    if (!email.endsWith("@oregonstate.edu")) {
      return NextResponse.redirect(
        new URL(
          `/signin?error=${encodeURIComponent(
            "Please use your @oregonstate.edu email to sign in."
          )}`,
          request.url
        )
      )
    }

    // Set cookies
    const response = await fetch(getBackendPath("/users/signin"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, email }),
      credentials: "include",
    })

    if (response.status != 403 && !response.ok) {
      return NextResponse.redirect(
        new URL("/signin?error=Authentication failed", request.url)
      )
    }

    const setCookies = response.headers.get("set-cookie")

    if (response.status === 403) {
      const res = NextResponse.redirect(
        new URL("/signin/username", request.url)
      )
      if (setCookies) res.headers.set("Set-Cookie", setCookies)
      return res
    }

    const res = NextResponse.redirect(new URL("/browse", request.url))
    if (setCookies) res.headers.set("Set-Cookie", setCookies)
    return res
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed"
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}
