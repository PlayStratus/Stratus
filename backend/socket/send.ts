import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { findNodeByGame, getAllNodes } from "./node.js"
import { createSession, deleteSession } from "./sessions.js"

const pendingStarts = new Map<string, (confirm: ConfirmStart | null) => void>()
const pendingStartSessions = new Map<string, string>()

interface ConfirmStart {
  type: string
  request_id: string
  timestamp: string
  payload: {
    session_id: string
    tls_fingerprint: string
    ip: string
  }
}

export function startGameSession(
  gameId: string,
  userId: string,
  userName: string,
  width: number,
  height: number,
): Promise<ConfirmStart | null> {
  //pass in value from request
  let session_id = uuidv4()
  const ws = findNodeByGame(gameId, session_id) //find game
  if (!ws) {
    //no game found return null
    console.error("No node available for game:", gameId)
    return Promise.resolve(null)
  }
  const nodeInfo = getAllNodes().get(ws)
  const nodeIp = nodeInfo?.node_payload.ip ?? ""
  let request_id = uuidv4()
  const startMessage = {
    //build message
    type: "start_session",
    request_id,
    timestamp: new Date().toISOString(),
    payload: {
      session_id,
      game_id: gameId,
      width,
      height,
      user_id: userId,
      user_name: userName,
    },
  }

  return new Promise((resolve) => {
    //wait for start return
    pendingStarts.set(request_id, resolve) //store id in map
    pendingStartSessions.set(session_id, request_id)
    createSession({
      start: Math.floor(new Date().getTime() / 1000),
      node: nodeInfo?.node_payload.hostname ?? "Unknown",
      sessionId: startMessage.payload.session_id,
      gameId: startMessage.payload.game_id,
      width: startMessage.payload.width,
      height: startMessage.payload.height,
      userId: startMessage.payload.user_id,
      userName: startMessage.payload.user_name,
    });

    setTimeout(() => {
      // timeout if node never responds
      if (pendingStarts.has(request_id)) {
        pendingStarts.delete(request_id) //delete request
        pendingStartSessions.delete(session_id)
        deleteSession(session_id)
        resolve(null) //return null if unable
      }
    }, 10_000) //wait 10 seconds

    ws.send(JSON.stringify(startMessage)) //send message
  })
}

export function resolveStart(message: ConfirmStart) {
  //called to update var
  const requestId = pendingStarts.has(message.request_id)
    ? message.request_id
    : pendingStartSessions.get(message.payload.session_id)

  if (!requestId) {
    console.warn(
      "Received start confirmation for unknown session:",
      message.payload.session_id,
    )
    return
  }

  const resolve = pendingStarts.get(requestId) //match id
  if (resolve) {
    pendingStarts.delete(requestId) //remove from map
    pendingStartSessions.delete(message.payload.session_id)
    resolve(message) //return message
  }
}
