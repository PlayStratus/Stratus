import { PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"

import { dynamoDb } from "../server.mjs"

export const ControllerGetUserByCredentials = async (req, res) => {
  try {
    const { username } = req.body

    if (!username) {
      throw new Error("Username is required")
    }

    if (typeof username !== "string") {
      throw new Error("Invalid input types")
    }

    const params = {
      TableName: "Users",
    }

    const result = await dynamoDb.send(new ScanCommand(params))
    const user = result.Items?.find(
      (item) => item.Username?.toLowerCase() === username.toLowerCase()
    )

    if (!user) {
      throw new Error("User not found")
    }

    const accessToken = jwt.sign(
      { userId: user.UserID },
      process.env.ACCESS_SECRET
    )
    const refreshToken = jwt.sign(
      { userId: user.UserID },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" }
    )

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    res.status(200).json({
      message: "Login successful",
    })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
}

export const ControllerRefreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token

    if (!refreshToken) {
      throw new Error("Refresh token is required")
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET)
    const userId = decoded.userId

    const newAccessToken = jwt.sign(
      { userId: userId },
      process.env.ACCESS_SECRET
    )

    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: true, // Always true for cross-site cookies
      sameSite: "None", // Required for cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })

    res.status(200).json({
      message: "Token refreshed successfully",
    })
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" })
  }
}

export const ControllerVerifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No token provided")
    }

    const token = authHeader.substring(7)

    const decoded = jwt.verify(token, process.env.ACCESS_SECRET)

    res.status(200).json({
      valid: true,
      userId: decoded.userId,
    })
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: error.message,
    })
  }
}

export const ControllerLogout = async (req, res) => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true, // Always true for cross-site cookies
      sameSite: "None", // Required for cross-site cookies
    })
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: true, // Always true for cross-site cookies
      sameSite: "None", // Required for cross-site cookies
    })

    res.status(200).json({
      message: "Logged out successfully",
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const ControllerCreateUser = async (req, res) => {
  try {
    const { username, email } = req.body

    if (!username || !email) {
      throw new Error("Username and Email are required")
    }

    if (typeof username !== "string" || typeof email !== "string") {
      throw new Error("Invalid input types")
    }

    if (!email.endsWith("@oregonstate.edu")) {
      throw new Error("Email must be an Oregon State University email")
    }

    const userId = uuidv4()

    const newUser = {
      UserID: userId,
      Username: username,
      Email: email,
    }

    await createUser(newUser)

    const accessToken = jwt.sign({ userId: userId }, process.env.ACCESS_SECRET)
    const refreshToken = jwt.sign(
      { userId: userId },
      process.env.REFRESH_SECRET,
      { expiresIn: "7d" }
    )

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: true, // Always true for cross-site cookies
      sameSite: "None", // Required for cross-site cookies
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: true, // Always true for cross-site cookies
      sameSite: "None", // Required for cross-site cookies
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.status(200).json({
      message: "User created successfully",
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

const createUser = async (user) => {
  const { UserID, Username, Email } = user

  if (typeof UserID !== "string" || !Username || !Email) {
    //ToDo: make more thorough
    throw new Error("Invalid user format")
  }

  const allUsersParams = {
    TableName: "Users",
  }

  const allUsersResult = await dynamoDb.send(new ScanCommand(allUsersParams))

  const existingUsername = allUsersResult.Items?.find(
    (item) => item.Username?.toLowerCase() === Username.toLowerCase()
  )
  if (existingUsername) {
    throw new Error("Username already exists")
  }

  const existingEmail = allUsersResult.Items?.find(
    (item) => item.Email?.toLowerCase() === Email.toLowerCase()
  )
  if (existingEmail) {
    throw new Error("Email already exists")
  }

  const params = {
    //create new user
    TableName: "Users",
    Item: { UserID, Username, Email },
  }

  await dynamoDb.send(new PutCommand(params)) //send to aws
  return params.Item
}
