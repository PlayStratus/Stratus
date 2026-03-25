"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { getBackendPath } from "@/lib/backend/getBackendPath"

type AuthUser = {
  UserID: string
  Username: string
  Email: string
}

type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "needs-username"

type GoogleSignInResult = {
  needsUsername: boolean
}

type AuthContextValue = {
  status: AuthStatus
  token: string | null
  user: AuthUser | null
  signInWithGoogle: (credential: string) => Promise<GoogleSignInResult>
  createUsername: (username: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AUTH_TOKEN_STORAGE_KEY = "stratus_auth_token"

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

const storeToken = (token: string) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
}

const clearStoredToken = () => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

const getAuthorizationHeader = (token: string) => ({
  Authorization: `Bearer ${token}`,
})

const getErrorMessage = (payload: unknown, fallback: string): string => {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error
  }

  return fallback
}

const getUserFromPayload = (payload: unknown): AuthUser | null => {
  if (
    payload &&
    typeof payload === "object" &&
    "user" in payload &&
    payload.user &&
    typeof payload.user === "object"
  ) {
    return payload.user as AuthUser
  }

  return null
}

const getTokenFromPayload = (payload: unknown): string | null => {
  if (
    payload &&
    typeof payload === "object" &&
    "token" in payload &&
    typeof payload.token === "string"
  ) {
    return payload.token
  }

  return null
}

async function fetchCurrentUser(token: string): Promise<{
  status: AuthStatus
  user: AuthUser | null
}> {
  const response = await fetch(getBackendPath("/auth"), {
    method: "GET",
    headers: getAuthorizationHeader(token),
    cache: "no-store",
  })

  const payload = await response.json().catch(() => null)

  if (response.ok) {
    return {
      status: "authenticated",
      user: getUserFromPayload(payload),
    }
  }

  if (response.status === 404) {
    return {
      status: "needs-username",
      user: null,
    }
  }

  throw new Error(getErrorMessage(payload, "Authentication failed"))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  const refreshUser = async () => {
    const activeToken = token ?? getStoredToken()
    if (!activeToken) {
      setToken(null)
      setUser(null)
      setStatus("unauthenticated")
      return
    }

    setStatus("loading")

    try {
      const nextAuthState = await fetchCurrentUser(activeToken)
      setToken(activeToken)
      setUser(nextAuthState.user)
      setStatus(nextAuthState.status)
    } catch {
      clearStoredToken()
      setToken(null)
      setUser(null)
      setStatus("unauthenticated")
    }
  }

  useEffect(() => {
    void refreshUser()
  }, [])

  const signInWithGoogle = async (
    credential: string,
  ): Promise<GoogleSignInResult> => {
    setStatus("loading")

    const response = await fetch(getBackendPath("/auth/google"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credential }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok && response.status !== 403) {
      setStatus("unauthenticated")
      throw new Error(getErrorMessage(payload, "Google sign-in failed"))
    }

    const nextToken = getTokenFromPayload(payload)
    if (!nextToken) {
      setStatus("unauthenticated")
      throw new Error("Authentication token missing from response")
    }

    storeToken(nextToken)
    setToken(nextToken)

    if (response.status === 403) {
      setUser(null)
      setStatus("needs-username")
      return { needsUsername: true }
    }

    const nextUser = getUserFromPayload(payload)
    setUser(nextUser)
    setStatus(nextUser ? "authenticated" : "needs-username")

    return { needsUsername: !nextUser }
  }

  const createUsername = async (username: string): Promise<AuthUser> => {
    const activeToken = token ?? getStoredToken()
    if (!activeToken) {
      throw new Error("Authentication token missing")
    }

    const response = await fetch(getBackendPath("/auth/create"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthorizationHeader(activeToken),
      },
      body: JSON.stringify({ username }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, "Failed to set username"))
    }

    const nextUser = getUserFromPayload(payload)
    if (!nextUser) {
      throw new Error("User missing from response")
    }

    setToken(activeToken)
    setUser(nextUser)
    setStatus("authenticated")

    return nextUser
  }

  const logout = async () => {
    const activeToken = token ?? getStoredToken()

    if (activeToken) {
      try {
        await fetch(getBackendPath("/auth/logout"), {
          method: "POST",
          headers: getAuthorizationHeader(activeToken),
        })
      } catch {
        // Logging out locally is enough if the network request fails.
      }
    }

    clearStoredToken()
    setToken(null)
    setUser(null)
    setStatus("unauthenticated")
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        token,
        user,
        signInWithGoogle,
        createUsername,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
