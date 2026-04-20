import { WebSocket } from "ws"
import { updateHeartbeat, getNodeInfo } from "./node.js"
import { resolveStart } from "./send.js"
import { loadSession } from "./sessions.js"

export function handleMessage(ws: WebSocket, message: any) {
  //most functions here are currently placeholder to build out
  switch (message.type) {
    case "heartbeat":
      updateHeartbeat(ws, message.payload)
      break

    case "start_confirmed":
      start_confirmed(ws, message)
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

function start_confirmed(ws: WebSocket, message: any) {
  const { session_id, tls_fingerprint } = message.payload
  console.log(
    `Session started. session: ${session_id} | TLS: ${tls_fingerprint}`,
  )
  if (!session_id || !tls_fingerprint) {
    throw new Error("Missing required fields: session_id, tls_fingerprint")
  }

  loadSession(session_id, ws)

  const nodeInfo = getNodeInfo(ws)
  if (nodeInfo) {
    const ip = nodeInfo.node_payload.ip

    message.payload.ip = ip
  }

  resolveStart(message)
}

function stop_session(ws: WebSocket) {
  console.log("stop")
}

function session_error(ws: WebSocket) {
  console.log("error")
}
