export interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope: string
  id_token: string
}

export interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }

  return "http://localhost:3000"
}

export async function getGoogleAuthUrl(): Promise<string> {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth"

  const options = {
    redirect_uri: `${getBaseUrl()}/api/auth/callback/google`,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  }

  const qs = new URLSearchParams(options)
  return `${rootUrl}?${qs.toString()}`
}

export async function getGoogleTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const url = "https://oauth2.googleapis.com/token"

  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: `${getBaseUrl()}/api/auth/callback/google`,
    grant_type: "authorization_code",
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
  })

  if (!response.ok) {
    throw new Error("Failed to fetch Google tokens")
  }

  return response.json()
}

export async function getGoogleUser(
  access_token: string
): Promise<GoogleUserInfo> {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch Google user")
  }

  return response.json()
}
