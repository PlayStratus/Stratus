import { google } from "googleapis"
import type { OAuth2Client } from "google-auth-library"

export interface GoogleUserInfo {
  id: string
  email: string
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  return "http://localhost:3000"
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${getBaseUrl()}/api/auth/callback/google`
  )
}

export async function getGoogleAuthUrl(): Promise<string> {
  const oauth2Client = getOAuth2Client()

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  })

  return url
}
export async function getGoogleTokens(
  code: string
): Promise<OAuth2Client["credentials"]> {
  const oauth2Client = getOAuth2Client()

  const { tokens } = await oauth2Client.getToken(code)

  return tokens
}

export async function getGoogleUser(
  access_token: string
): Promise<GoogleUserInfo> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ access_token })

  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  })

  const { data } = await oauth2.userinfo.get()

  return {
    id: data.id!,
    email: data.email!,
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<string> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  return credentials.access_token!
}

export async function verifyAccessToken(
  access_token: string
): Promise<boolean> {
  try {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token })

    const tokenInfo = await oauth2Client.getTokenInfo(access_token)

    // Check if token is expired
    if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now()) {
      return false
    }

    return true
  } catch (error) {
    console.error("Token verification failed:", error)
    return false
  }
}
