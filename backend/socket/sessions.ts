import { WebSocket } from "ws"

export interface Session {
  start: number
  node: string
  sessionId: string
  gameId: string
  width: number
  height: number
  userId: string
  userName: string
}

const sessions = new Map<string, Session>()

export function createSession(s: Session) {
  if (sessions.has(s.sessionId)) {
    console.warn("Overwritting session:", s.sessionId)
  } else {
    console.log("Creating session:", s.sessionId)
  }
  sessions.set(s.sessionId, s)
}

export function deleteNodeSessions(node: string) {
  console.log("Deleting sessions for node", node)
  sessions.forEach((s: Session, id: string) => {
    if (s.node === node)
      deleteSession(id)
  });
}

export function deleteSession(id: string) {
  console.log("Deleting session:", id)
  sessions.delete(id)
}

export function getSessions() {
  return sessions
}
