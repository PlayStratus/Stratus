import { WebSocket } from "ws"

export function handleMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case "heartbeat":
      heartbeat(ws)
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


function heartbeat(ws: WebSocket) {
  console.log("heartbeat" )
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

