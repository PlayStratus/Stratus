import jwt from "jsonwebtoken"
import type { Request } from "express"

export interface Token {
  userId: string
  email?: string
}

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} is not defined in environment variables`)
  }
  return value
}

export const getTokenFromAuthorizationHeader = (req: Request): string => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Authorization header missing or malformed")
  }

  return authHeader.slice("Bearer ".length)
}

export const verifyAuthToken = (token: string): Token => {
  try {
    return jwt.verify(token, getEnv("AUTH_SECRET")) as Token
  } catch {
    throw new Error("Invalid or expired token")
  }
}
