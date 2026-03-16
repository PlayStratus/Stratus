import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { OAuth2Client } from "google-auth-library"
import jwt from "jsonwebtoken"
import type { Request, Response } from "express"

import { dynamoDb } from "../server.js"

import type { Token } from "../lib/authToken.js"
import {
  getTokenFromAuthorizationHeader,
  verifyAuthToken,
} from "../lib/authToken.js"

interface User {
  UserID: string
  Username: string
  Email: string
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} is not defined in environment variables`)
  }
  return value
}

export const getUserById = async (id: string): Promise<User | undefined> => {
  const result = await dynamoDb.send(
    new GetCommand({
      TableName: "Users",
      Key: {
        UserID: id,
      },
    }),
  )

  return (result.Item as User) || undefined
}

const createUser = async (user: Partial<User>): Promise<User> => {
  const { UserID, Username, Email } = user

  const allUsersResult = await dynamoDb.send(
    new ScanCommand({
      TableName: "Users",
    }),
  )

  const existingUsername = allUsersResult.Items?.find(
    (item) => item.Username?.toLowerCase() === Username!.toLowerCase(),
  )

  if (existingUsername) {
    throw new Error("Username already exists")
  }

  const newUser = {
    UserID,
    Username,
    Email,
  }

  await dynamoDb.send(
    new PutCommand({
      TableName: "Users",
      Item: newUser,
    }),
  )

  return newUser as User
}

const createAuthToken = (tokenPayload: Token): string => {
  return jwt.sign(tokenPayload, getEnv("AUTH_SECRET"), {
    expiresIn: "7d",
  })
}

export const ControllerGoogleAuth = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ error: "Missing credential" })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()

    if (!payload) {
      return res.status(401).json({ error: "Invalid token" })
    }

    const googleUser = {
      googleSub: payload.sub,
      email: payload.email,
    }

    if (!googleUser.email?.endsWith("@oregonstate.edu")) {
      return res.status(401).json({
        error: "Please use your @oregonstate.edu email to sign in.",
      })
    }

    const existingUser = await getUserById(googleUser.googleSub)
    const authToken = createAuthToken({
      userId: googleUser.googleSub,
      email: googleUser.email,
    })

    if (!existingUser) {
      return res.status(403).json({
        error: "User not found",
        token: authToken,
      })
    }

    return res.status(200).json({
      token: authToken,
      user: existingUser,
    })
  } catch (error) {
    console.error(error)
    return res.status(401).json({ error: "Google auth failed" })
  }
}

export const ControllerCreateUser = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { username } = req.body as { username?: string }

    if (!username) {
      throw new Error("Username is required")
    }

    const token = getTokenFromAuthorizationHeader(req)
    const decodedToken = verifyAuthToken(token)

    const createdUser = await createUser({
      UserID: decodedToken.userId,
      Username: username,
      Email: decodedToken.email ?? "",
    })

    return res.status(201).json({ user: createdUser })
  } catch (error: any) {
    return res.status(400).json({ error: error.message })
  }
}

export const ControllerGetUserByToken = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const token = getTokenFromAuthorizationHeader(req)
    const decodedToken = verifyAuthToken(token)
    const user = await getUserById(decodedToken.userId)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.status(200).json({ user })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}

export const ControllerLogout = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.status(200).json({ ok: true })
}
