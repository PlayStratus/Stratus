import type { Request, Response } from "express"

import { startGameSession } from "../socket/send.js"
import { getAllNodes } from "../socket/node.js"

import type { Token } from "../lib/authToken.js"
import {
  getTokenFromAuthorizationHeader,
  verifyAuthToken,
} from "../lib/authToken.js"
import { getUserById } from "./authController.js"

export const ControllerCreateSession = async (req: Request, res: Response) => {
  const { game_id, height, width } = req.body

  console.log("Received request to create session with data:", {
    game_id,
    height,
    width,
  })

  if (!game_id || !height || !width) {
    return res
      .status(400)
      .json({ error: "Missing requested data are required" })
  }

  let decodedToken: Token | undefined = undefined

  try {
    const token = getTokenFromAuthorizationHeader(req)
    decodedToken = verifyAuthToken(token)

    if (!decodedToken?.userId) {
      return res.status(403).json({ error: "Invalid token for user" })
    }
  } catch (error: any) {
    return res.status(401).json({ error: error.message })
  }

  const user_id = decodedToken.userId

  const user = await getUserById(user_id)

  if (!user) {
    return res.status(403).json({ error: "User not found" })
  }

  console.log(
    `Starting session for user ${user.Username} (ID: ${user_id}) and game ${game_id} with resolution ${width}x${height}`,
  )

  const result = await startGameSession(
    game_id,
    user_id,
    user.Username,
    width,
    height,
  )
  if (!result) {
    return res
      .status(503)
      .json({ error: "No node available or session timed out" })
  }

  return res.status(201).json({
    session_id: result.payload.session_id,
    tls_fingerprint: result.payload.tls_fingerprint,
    ip: result.payload.ip,
  })
}

export function ControllerGetNodes(req: Request, res: Response) {
  const nodesArray = Array.from(getAllNodes().entries()).map(([, info]) => ({
    name: info.name,
    last_heartbeat: info.last_heartbeat,
    payload: info.node_payload,
  }))
  res.json(nodesArray)
}
