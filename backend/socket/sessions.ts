import { WebSocket } from "ws"

interface SessionInfo {
  sessionId: string
  node: WebSocket
  status: string
}

const sessions = new Map<string, SessionInfo>()

export function loadNode(ses: string, inNode: WebSocket) {              //load node into session
  if (!sessions.has(ses)) {                                             //check if a connection already exists
    sessions.set(ses, {                                                 //add to session
        sessionId : ses,
        node : inNode,                                                  //this just shows last connection, not necissarily last heartbeat sent
        status : "Live",
    })
  }
  else{
    console.error("Error: Session Already Exists");
  }
}

export function deleteSession(ses: string) {                          //remove node, here incase there is an issue with a node that we have to take down
  sessions.delete(ses)
}

export function getSessions() {                                         //remove node, here incase there is an issue with a node that we have to take down
  return sessions
}