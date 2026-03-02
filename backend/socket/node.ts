import { WebSocket } from "ws"

interface NodeInfo {
  name: string
  last_heartbeat: number
  nodes_stats?: any         //we could load data here
}

const nodes = new Map<WebSocket, NodeInfo>()

export function loadNode(ws: WebSocket, name: string) {             //load node into nodes
  if (!nodes.has(ws)) {                                             //check if a connection already exists
    nodes.set(ws, {                                                 //add to nodes
      name,
      last_heartbeat: Date.now(),                                   //this just shows last connection, not necissarily last heartbeat sent
    })
  }
}

export function updateHeartbeat(ws: WebSocket, stats?: any) {        //update hartbeet
  const node = nodes.get(ws)                                         //get connection
  if (!node) return             

  node.last_heartbeat = Date.now()                                  
  node.nodes_stats = stats
}

export function deleteNode(ws: WebSocket) {                          //remove node, here incase there is an issue with a node that we have to take down
  nodes.delete(ws)
}

export function getAllNodes() {
  return nodes
}