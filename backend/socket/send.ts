import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { findNodeByGame } from "./node"

export function startGameSession(gameId: string, userId: string, userName: string) {        //pass in value from request
  const ws = findNodeByGame(gameId)                                                         //find game
  if (!ws) {
    console.error("No node available for game:", gameId)
    return
  }
  const startMessage = {                                                                    //build message
    type: "start",
    request_id: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: {
      session_id: uuidv4(),
      game_id: gameId,
      width: "temp",
      height: "temp",
      session_token: "temp",
      user_id: userId,
      user_name: userName,
    },
  }

  ws.send(JSON.stringify(startMessage))
}