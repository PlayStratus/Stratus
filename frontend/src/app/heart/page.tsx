"use client"
import { useEffect, useState } from "react"
import { getHeartbeat, NodeHeartbeat } from "../../lib/actions/heartbeat"

export default function NodeHeartbeats() {
  const [nodes, setNodes] = useState<NodeHeartbeat[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    setLastUpdate(new Date())

    getHeartbeat().then((data) => {
      if (data) setNodes(data)
    })

    const interval = setInterval(() => {
      setLastUpdate(new Date())

      getHeartbeat().then((data) => {
        if (data) setNodes(data)
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-semibold tracking-tight'>
          Node Heartbeats
        </h1>
        <p className='text-sm text-muted-foreground'>
          Last update: {lastUpdate ? formatLocalClock(lastUpdate) : "N/A"}
        </p>
      </header>

      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {nodes.map((node, i) => (
          <article
            key={i}
            className='rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm'
          >
            <div className='mb-3 flex items-start justify-between gap-3'>
              <h2 className='text-lg font-semibold'>{node.name}</h2>
              <span className='text-xs text-muted-foreground'>
                {node.last_heartbeat
                  ? formatLocalClock(new Date(node.last_heartbeat))
                  : "N/A"}
              </span>
            </div>

            {node.payload ? (
              <dl className='grid gap-2 text-sm sm:grid-cols-2'>
                <div>
                  <dt className='text-muted-foreground'>Hostname</dt>
                  <dd>{node.payload.hostname}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Version</dt>
                  <dd>{node.payload.version}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Uptime</dt>
                  <dd>{formatDuration(node.payload.uptime)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>CPU load</dt>
                  <dd>
                    {node.payload.cpu_load} / {node.payload.cpu_count} cores
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>RAM</dt>
                  <dd>
                    {node.payload.ram_used} / {node.payload.ram_total} bytes
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Disk</dt>
                  <dd>
                    {node.payload.disk_used} / {node.payload.disk_total} bytes
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Temperature</dt>
                  <dd>{node.payload.temperature}°C</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Sessions</dt>
                  <dd>{node.payload.sessions}</dd>
                </div>
                <div className='sm:col-span-2'>
                  <dt className='text-muted-foreground'>Games</dt>
                  <dd>{node.payload.games.join(", ")}</dd>
                </div>
              </dl>
            ) : (
              <p className='text-sm text-muted-foreground'>No payload, Error</p>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}

function formatLocalClock(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  const fraction = (date.getMilliseconds() * 10).toString().padStart(4, "0")
  const timeZone =
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "local"

  return `${hours}:${minutes}:${seconds}:${fraction} [${timeZone}]`
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`
}
