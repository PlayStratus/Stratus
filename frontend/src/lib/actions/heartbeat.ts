import { getBackendPath } from "@/lib/backend/getBackendPath"

export interface NodePayload {
  hostname: string
  version: string
  games: string[]
  sessions: string[]
  uptime: number
  cpu_load: number
  cpu_count: number
  ram_used: number
  ram_total: number
  disk_used: number
  disk_total: number
  temperature: number
}

export interface NodeHeartbeat {
  name: string
  last_heartbeat: number
  payload: NodePayload
}

export async function getHeartbeat() {
  try {
    const response = await fetch(getBackendPath("/play/nodes"), {
      method: "GET",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error body:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: NodeHeartbeat[] = await response.json();
    console.log(data)
    return data;
  } catch (error) {
    
  }
}