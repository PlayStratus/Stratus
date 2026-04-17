import { WebSocket } from "ws"
import { v4 as uuidv4 } from "uuid"
import { findNodeByGame, getAllNodes } from "./node.js"

const pendingStarts = new Map<string, (confirm: ConfirmStart | null) => void>()

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

export function startGameSession(gameId: string, userId: string, userName: string, width: number, height: number): Promise<ConfirmStart | null> {        //pass in value from request
  let session_id = uuidv4()
  const ws = findNodeByGame(gameId, session_id)                                                         //find game
  if (!ws) {                                                                                //no game found return null
    console.error("No node available for game:", gameId)
    return Promise.resolve(null);
  }
  const nodeInfo = getAllNodes().get(ws)
  const nodeIp = nodeInfo?.node_payload.ip ?? ""
  let request_id = uuidv4()
  const startMessage = {                                                                    //build message
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

 return new Promise<ConfirmStart | null>((resolve) => {                       //wait for start return
    pendingStarts.set(request_id, resolve)                //store id in map

    setTimeout(() => {                                    // timeout if node never responds
      if (pendingStarts.has(request_id)) {
        pendingStarts.delete(request_id)                  //delete request
        resolve(null)                                     //return null if unable
      }
    }, 10_000)                                             //wait 10 seconds

    ws.send(JSON.stringify(startMessage))                 //send message
  }).then((result: ConfirmStart | null) => {
    if (result) {
      result.payload.ip = nodeIp
    }
    return result
  })
}

export function resolveStart(message: ConfirmStart) {           //called to update var
  const resolve = pendingStarts.get(message.request_id)         //match id
  if (resolve) {
    pendingStarts.delete(message.request_id)                    //remove from map
    resolve(message)                                            //return message **add ip here
  }
}
