import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { findNodeByGame } from "./node"

export function startGameSession(gameId: string, userId: string, userName: string) {
  const ws = findNodeByGame(gameId)
  if (!ws) {
    console.error("No node available for game:", gameId)
    return
  }
  const startMessage = {
    type: "start",
    request_id: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: {
      session_id: uuidv4(),
      game_id: gameId,
      width: "1920",
      height: "1080",
      session_token: "temp",
      user_id: userId,
      user_name: userName,
    },
  }

  ws.send(JSON.stringify(startMessage))
}