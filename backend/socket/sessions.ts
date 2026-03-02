import { WebSocket } from "ws"

interface SessionInfo {
  sessionId: string
  node: WebSocket
  status: string
}