"use client"
import { useEffect, useState } from "react"
import { getHeartbeat, NodeHeartbeat, NodePayload} from "../../lib/actions/heartbeat"

export default function NodeHeartbeats() {
  const [nodes, setNodes] = useState<NodeHeartbeat[]>([])

  useEffect(() => {
    getHeartbeat().then((data) => {
      if (data) setNodes(data)
    })
  }, [])

  return (
  <div>
    {nodes.map((node) => (
      <div key={node.name}>
        <p>Name: {node.name}</p>
        <p>Last heartbeat: {node.last_heartbeat}</p>
        {node.payload ? (
  <>
    <p>Hostname: {node.payload.hostname}</p>
    <p>Version: {node.payload.version}</p>
    <p>Uptime: {node.payload.uptime}</p>
    <p>CPU load: {node.payload.cpu_load} / {node.payload.cpu_count} cores</p>
    <p>RAM: {node.payload.ram_used} / {node.payload.ram_total} bytes</p>
    <p>Disk: {node.payload.disk_used} / {node.payload.disk_total} bytes</p>
    <p>Temperature: {node.payload.temperature}°C</p>
    <p>Games: {node.payload.games.join(", ")}</p>
    <p>Sessions: {node.payload.sessions}</p>
    <br></br>
  </>
    ) : (
      <p>No payload, Error</p>
    )}
      </div>
    ))}
  </div>
)
}