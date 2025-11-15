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

    console.log(tokens)

    if (!tokens.access_token) {
      throw new Error("No access token received from Google")
    }

    const { id, email } = await getGoogleUser(tokens.access_token)

    if (!email.endsWith("@oregonstate.edu")) {
      return NextResponse.redirect(
        new URL(
          `/signin?error=${encodeURIComponent(
            "Please use your oregonstate.edu email to sign in."
          )}`,
          request.url
        )
      )
    }

    // Set cookies
    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === "production"

    cookieStore.set("access_token", tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3599,
      path: "/",
    })

    if (tokens.refresh_token) {
      cookieStore.set("refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    if (tokens.expiry_date) {
      cookieStore.set("token_expiry", tokens.expiry_date.toString(), {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    // TODO: Send user ID to check if it exists in our backend
    return NextResponse.redirect(new URL("/signin/username", request.url))

    return NextResponse.redirect(new URL("/browse", request.url))
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Authentication failed"
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}
