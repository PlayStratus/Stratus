import { NextResponse } from "next/server"
import { getGoogleAuthUrl } from "@/lib/auth"

export async function GET() {
  try {
    const url = await getGoogleAuthUrl()
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("Error initiating Google OAuth:", error)
    return NextResponse.json(
      { error: "Failed to initiate Google sign-in" },
      { status: 500 }
    )
  }
}
