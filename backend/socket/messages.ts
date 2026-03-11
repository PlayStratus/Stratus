import { WebSocket } from "ws"
import { updateHeartbeat, getAllNodes } from "./node.ts"

export function handleMessage(ws: WebSocket, message: any) {        //most functions here are currently placeholder to build out
  switch (message.type) {
    case "heartbeat":
      updateHeartbeat(ws, message.payload)
      console.log(getAllNodes());
      break

    case "start_confirmed":
      start_confirmed(message)
      break

    case "stop_session":
      stop_session(message)
      break

    case "session_error":
      session_error(message)
      break

    default:
      console.warn("Unknown message type:", message.type)
  }
}


function start_confirmed(ws: WebSocket) {
  console.log("start")
}

function stop_session(ws: WebSocket) {
  console.log("stop")
}

function session_error(ws: WebSocket) {
  console.log("error")
}

