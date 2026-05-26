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

export function pruneNodeSessions(node: string, nodeSessions: string[]) {
  sessions.forEach((s: Session, id: string) => {
    if (s.node === node && !nodeSessions.includes(s.sessionId)) {
      console.log("Pruning session", s.sessionId, "for node", node)
      deleteSession(id)
    }
  });
}

export function deleteNodeSessions(node: string) {
  sessions.forEach((s: Session, id: string) => {
    if (s.node === node) {
      console.log("Deleting session", s.sessionId, "for node", node)
      deleteSession(id)
    }
  });
}

export function deleteSession(id: string) {
  console.log("Deleting session:", id)
  sessions.delete(id)
}

export function getSessions() {
  return sessions
}
