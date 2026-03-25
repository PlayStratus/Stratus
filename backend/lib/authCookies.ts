import type { CookieOptions, Response } from "express"

const isProduction = process.env.NODE_ENV === "production"
const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const getAuthCookieDomain = (): string | undefined => {
  const configuredDomain = process.env.AUTH_COOKIE_DOMAIN?.trim()
  if (configuredDomain) {
    return configuredDomain.replace(/^\./, "")
  }

  const frontendUrl = process.env.FRONTEND_URL?.trim()
  if (!frontendUrl) {
    return undefined
  }

  try {
    const hostname = new URL(frontendUrl).hostname

    if (hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
      return undefined
    }

    const labels = hostname.split(".")
    if (labels.length === 2) {
      return hostname
    }

    const sharedSubdomains = new Set(["www", "app", "api"])
    if (labels.length >= 3 && sharedSubdomains.has(labels[0])) {
      return labels.slice(1).join(".")
    }
  } catch {
    return undefined
  }

  return undefined
}

const authCookieDomain = getAuthCookieDomain()

const sharedCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
  ...(authCookieDomain ? { domain: authCookieDomain } : {}),
}

export const authCookieOptions: CookieOptions = {
  ...sharedCookieOptions,
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
}

export const clearCookieOptions: CookieOptions = sharedCookieOptions

export const setAuthCookie = (res: Response, authToken: string) => {
  res.cookie("auth_token", authToken, authCookieOptions)
}
