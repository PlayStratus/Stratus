import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import type { Request, Response } from "express"

import { startGameSession, resolveStart} from "../socket/send.js"

import { dynamoDb } from "../server.js"

interface User {
  UserID: string // Partition key
  Username: string
  Email: string
}

interface Token {
  userId: string
}

const getEnv = (key: string): string => {
  //ensures Env values are present
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} is not defined in environment variables`)
  }
  return value
}

export const ControllerGetUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.body as any

    if (!id) {
      throw new Error("Google ID is required")
    }

    const authToken = jwt.sign({ userId: id } as Token, getEnv("AUTH_SECRET"), {
      expiresIn: "7d",
    })

    const params = {
      TableName: "Users",
      Key: {
        UserID: id,
      },
    }

    const result = await dynamoDb.send(new GetCommand(params))
    const user = (result.Item as User) || undefined

    res.cookie("auth_token", authToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })

    if (!user) {
      return res.status(403).json({ error: "User not found" })
    }

    return res.status(200).json({ user })
  } catch (error: any) {
    return res.status(404).json({ error: error.message })
  }
}

export const ControllerCreateUser = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { username } = req.body as any

    if (!username) {
      throw new Error("Username is required")
    }

    // get auth token from header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Authorization header missing or malformed")
    }

    const token = authHeader.split(" ")[1]
    let decodedToken: Token
    try {
      decodedToken = jwt.verify(token, getEnv("AUTH_SECRET")) as Token
    } catch (err) {
      throw new Error("Invalid or expired token")
    }

    const id = decodedToken.userId

    const newUser: Partial<User> = {
      UserID: id,
      Username: username,
      Email: "", // Email can be set to empty or fetched from another source if needed
    }

    console.log(newUser)

    const createdUser = await createUser(newUser)

    const authToken = jwt.sign({ userId: id } as Token, getEnv("AUTH_SECRET"), {
      expiresIn: "7d",
    })

    res.cookie("auth_token", authToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })

    return res.status(201).json({ user: createdUser })
  } catch (error: any) {
    console.log(error)

    return res.status(400).json({ error: error.message })
  }
}

export const ControllerGetUserByToken = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    // get auth token from header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Authorization header missing or malformed")
    }

    const token = authHeader.split(" ")[1]
    let decodedToken: Token
    try {
      decodedToken = jwt.verify(token, getEnv("AUTH_SECRET")) as Token
    } catch (err) {
      throw new Error("Invalid or expired token")
    }

    const id = decodedToken.userId

    const params = {
      TableName: "Users",
      Key: {
        UserID: id,
      },
    }

    const result = await dynamoDb.send(new GetCommand(params))
    const user = (result.Item as User) || undefined

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.status(200).json({ user })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}

export const ControllerRefreshToken = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const refreshToken = req.cookies["refresh_token"]
    if (!refreshToken) {
      throw new Error("Refresh token missing")
    }

    let decodedToken: Token
    try {
      decodedToken = jwt.verify(refreshToken, getEnv("REFRESH_SECRET")) as Token
    } catch (err) {
      throw new Error("Invalid or expired refresh token")
    }

    const id = decodedToken.userId

    const newAuthToken = jwt.sign(
      { userId: id } as Token,
      getEnv("AUTH_SECRET"),
      {
        expiresIn: "7d",
      },
    )

    res.cookie("auth_token", newAuthToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })

    return res.status(200).json({ message: "Token refreshed" })
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }
}

const createUser = async (user: Partial<User>): Promise<User> => {
  const { UserID, Username, Email } = user

  const allUsersParams = {
    TableName: "Users",
  }

  const allUsersResult = await dynamoDb.send(new ScanCommand(allUsersParams))

  const existingUsername = allUsersResult.Items?.find(
    (item) => item.Username?.toLowerCase() === Username!.toLowerCase(),
  )
  if (existingUsername) {
    throw new Error("Username already exists")
  }

  const params = {
    //create new user
    TableName: "Users",
    Item: { UserID, Username, Email },
  }

  await dynamoDb.send(new PutCommand(params)) //send to aws
  return params.Item as User
}

export const ControllerCreateSession = async (req: Request, res: Response) => {
  const { game_id, user_id, user_name, height, width } = req.body

  if (!game_id || !user_id || !user_name || !height || !width) {
    return res.status(400).json({ error: "Missing requented data are required" })
  }

  const result = await startGameSession(game_id, user_id, user_name, width, height)
  if (!result) {
    return res.status(503).json({ error: "No node available or session timed out" })
  }

  return res.status(201).json({
    session_id: result.payload.session_id,
    TLSFingerprint: result.payload.tls_fingerprint,
  })
}
