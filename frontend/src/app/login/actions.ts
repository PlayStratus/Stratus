"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getBackendPath } from "@/lib/backend/getBackendPath"

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string

  if (!username) {
    return { error: "Username is required" }
  }

  try {
    const response = await fetch(getBackendPath("/users/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || "Login failed" }
    }

    const setCookieHeaders = response.headers.getSetCookie()

    if (setCookieHeaders && setCookieHeaders.length > 0) {
      const cookieStore = await cookies()

      for (const cookieHeader of setCookieHeaders) {
        const [cookiePart, ...attributes] = cookieHeader.split(";")
        const [name, value] = cookiePart.trim().split("=")

        let maxAge = 86400 // default 24 hours
        for (const attr of attributes) {
          const [attrName, attrValue] = attr.trim().split("=")
          if (attrName.toLowerCase() === "max-age") {
            maxAge = parseInt(attrValue, 10)
            break
          }
        }

        cookieStore.set(name, value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: maxAge,
        })
      }
    }
  } catch (error) {
    console.error("Login error:", error)
    return {
      error: error instanceof Error ? error.message : "An error occurred",
    }
  }

  redirect("/browse")
}
