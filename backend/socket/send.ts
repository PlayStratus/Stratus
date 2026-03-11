import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { findNodeByGame } from "./node.ts"

const pendingStarts = new Map<string, (confirm: ConfirmStart | null) => void>()

interface ConfirmStart {
  type: string
  request_id: string
  timestamp: string
  payload: {
    session_id: string
    tls_fingerprint: string
  }
}

export function startGameSession(gameId: string, userId: string, userName: string, width: string, height: string): Promise<ConfirmStart | null> {        //pass in value from request
  const ws = findNodeByGame(gameId)                                                         //find game
  if (!ws) {                                                                                //no game found return null
    console.error("No node available for game:", gameId)
    return Promise.resolve(null);
  }
  let session_id = uuidv4()
  let request_id = uuidv4()
  const startMessage = {                                                                    //build message
    type: "start_session",
    request_id,
    timestamp: new Date().toISOString(),
    payload: {
      session_id,
      game_id: gameId,
      width: width,
      height: height,
      user_id: userId,
      user_name: userName,
    },
  }

  return new Promise((resolve) => {                       //wait for start return
    pendingStarts.set(request_id, resolve)                //store id in map

    setTimeout(() => {                                    // timeout if node never responds
      if (pendingStarts.has(request_id)) {
        pendingStarts.delete(request_id)                  //delete request
        resolve(null)                                     //return null if unable
      }
    }, 10_000)                                             //wait 10 seconds

    ws.send(JSON.stringify(startMessage))                 //send message
  })
}

export function resolveStart(message: ConfirmStart) {           //called to update var
  const resolve = pendingStarts.get(message.request_id)         //match id
  if (resolve) {
    pendingStarts.delete(message.request_id)                    //remove from map
    resolve(message)                                            //return message
  }
}