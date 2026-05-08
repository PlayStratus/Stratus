import type { Request, Response } from "express"

import { startGameSession } from "../socket/send.js"
import { getAllNodes } from "../socket/node.js"

import type { Token } from "../lib/authToken.js"
import {
  getTokenFromAuthorizationHeader,
  verifyAuthToken,
} from "../lib/authToken.js"
import { getUserById } from "./authController.js"

let lock = 0;

export const ControllerCreateSession = async (req: Request, res: Response) => {
  const { game_id, height, width } = req.body

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

  if (lock == 1 && (user.Username !== "carolrang" && user.Username !== "Johnhp1" && user.Username !== "asher" && user.Username !== "izzardthelizard" && user.Username !== "Nathen" && user.Username !== "Amin")){
    return res.status(403).json({ error: "Sorry, access is temporarily restricted" })
  }

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
  const nodesByIdentity = new Map<
    string,
    { name: string; last_heartbeat: number; payload: any }
  >()

  for (const info of getAllNodes().values()) {
    const node = {
      name: info.name,
      last_heartbeat: info.last_heartbeat,
      payload: info.node_payload,
    }
    const identity = `${info.node_payload.hostname}:${info.node_payload.ip}`
    const existing = nodesByIdentity.get(identity)

    if (!existing || node.last_heartbeat > existing.last_heartbeat) {
      nodesByIdentity.set(identity, node)
    }
  }

  res.json(Array.from(nodesByIdentity.values()))
}
