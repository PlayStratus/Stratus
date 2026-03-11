import { WebSocket } from "ws"

interface NodeInfo {
  name: string
  last_heartbeat: number
  node_payload: any                                                 //we load payload here
}

const nodes = new Map<WebSocket, NodeInfo>()

function loadNode(ws: WebSocket, inName: string, payload: any) {    //load node into nodes
  if (!nodes.has(ws)) {                                             //check if a connection already exists
    nodes.set(ws, {                                                 //add to nodes
      name: inName,
      last_heartbeat: Date.now(),                                   //this just shows last connection, not necissarily last heartbeat sent
      node_payload: payload
    })
  }
  else {
    console.error("Error: Socket Connection Already Exists");
  }
}

export function updateHeartbeat(ws: WebSocket, payload: any) {          //update hartbeet
    let node = nodes.get(ws)                                            //get connection
    if (!node) {
        loadNode(ws, payload.hostname, payload)
    }          
    node = nodes.get(ws)
        if (!node) return
    node.last_heartbeat = Date.now()                                  
    node.node_payload = payload
}

export function findNodeByGame(gameId: string): WebSocket | null {
  console.log()
  for (const [ws, node] of nodes.entries()) {
    if (node.node_payload.games.includes(gameId) && node.node_payload.sessions.length == 0) {
      return ws
    }
  }
  return null
}

export function deleteNode(ws: WebSocket) {                             //remove node, here incase there is an issue with a node that we have to take down
  nodes.delete(ws)
}

export function getAllNodes() {
  return nodes
}

