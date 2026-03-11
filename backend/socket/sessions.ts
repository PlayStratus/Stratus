import { WebSocket } from "ws"

interface SessionInfo {
  sessionId: string
  node: WebSocket
  status: string
}

const sessions = new Map<string, SessionInfo>()

export function loadSession(ses: string, inNode: WebSocket) {              //load node into session
  if (sessions.has(ses)) {
    console.warn("Session already exists, updating node:", ses)
  }
  sessions.set(ses, {
    sessionId: ses,
    node: inNode,
    status: "Live",
  })
}

export function deleteSession(ses: string) {                          //remove node, here incase there is an issue with a node that we have to take down
  sessions.delete(ses)
}

export function getSessions() {                                         //remove node, here incase there is an issue with a node that we have to take down
  return sessions
}