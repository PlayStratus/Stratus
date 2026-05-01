import { WebSocket } from "ws"

interface NodePayload {
  hostname: string
  games: string[]
  sessions: string[]
  ip: string
  [key: string]: any
}

interface NodeInfo {
  name: string
  last_heartbeat: number
  node_payload: NodePayload //we load payload here
}

const nodes = new Map<WebSocket, NodeInfo>()
let lastClear = Date.now()
const clearFrequency = 60 * 60 * 1000 //first 60 is for seconds 2nd for minutes, 1000 is to exit mil

function loadNode(ws: WebSocket, inName: string, payload: NodePayload) {
  //load node into nodes
  nodes.set(ws, {
    name: inName,
    last_heartbeat: Date.now(),
    node_payload: payload,
  })
}

export function updateHeartbeat(ws: WebSocket, payload: any) {
  //update heartbeat
  if (!isValidPayload(payload)) {
    //Check if required values are in the node payload
    console.error("Invalid payload, rejecting node") //if no error
    return
  }
  if (Date.now() - lastClear > clearFrequency) {
    //checks when old heartbeats were last cleared out. If not within our limit clear any old beats
    lastClear = Date.now()
    clearUnresponsive()
  }
  deleteDuplicateNodes(ws, payload)
  let node = nodes.get(ws) //get connection
  if (!node) {
    loadNode(ws, payload.hostname, payload)
  }
  node = nodes.get(ws)
  if (!node) return
  node.last_heartbeat = Date.now()
  node.node_payload = payload
}

export function findNodeByGame(
  gameId: string,
  sessionId: string,
): WebSocket | null {
  for (const [ws, node] of nodes.entries()) {
    if (Date.now() - node.last_heartbeat > 120000) {
      //heartbeat should happen every 30 seconds so if it misses 4 beats or 2 minutes we do not want to join it
      deleteNode(ws)
    } else if (
      node.node_payload.games.includes(gameId) &&
      node.node_payload.sessions.length == 0
    ) {
      //check if node includes needed game and if no user is on it
      node.node_payload.sessions.push(sessionId)
      return ws
    }
  }
  return null
}

export function deleteNode(ws: WebSocket) {
  //remove node, here in case there is an issue with a node that we have to take down
  nodes.delete(ws)
}

export function getAllNodes() {
  return nodes
}

function clearUnresponsive() {
  for (const [ws, node] of nodes.entries()) {
    if (Date.now() - node.last_heartbeat > 120000) {
      //heartbeat should happen every 30 seconds so if it misses 4 beats or 2 minutes we do not want to join it
      deleteNode(ws)
    }
  }
}

function deleteDuplicateNodes(currentWs: WebSocket, payload: NodePayload) {
  const identity = getNodeIdentity(payload)

  for (const [ws, node] of nodes.entries()) {
    if (ws !== currentWs && getNodeIdentity(node.node_payload) === identity) {
      deleteNode(ws)
    }
  }
}

function getNodeIdentity(payload: NodePayload) {
  return `${payload.hostname}:${payload.ip}`
}

function isValidPayload(payload: any): payload is NodePayload {
  //Checks to ensure payload is valid
  return (
    //we require games, sessions, and ip otherwise we could have an ungraceful exit. Hostname is important but would not cause a crash if left out. Can add more if required
    typeof payload.hostname === "string" &&
    Array.isArray(payload.games) &&
    Array.isArray(payload.sessions) &&
    typeof payload.ip === "string"
  )
}

export function getNodeInfo(ws: WebSocket): NodeInfo | undefined {
  return nodes.get(ws)
}
