"use client"

import { useEffect, useState } from "react"

import { getHeartbeat, NodeHeartbeat, getSessions, Session } from "@/lib/actions/dashboard"

export default function NodeHeartbeats() {
  const [nodes, setNodes] = useState<NodeHeartbeat[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    setLastUpdate(new Date())

    getHeartbeat().then((data) => {
      if (data) setNodes(data)
    })

    getSessions().then((data) => {
      if (data) setSessions(data)
    })

    const interval = setInterval(() => {
      setLastUpdate(new Date())

      getHeartbeat().then((data) => {
        if (data) setNodes(data)
      })

      getSessions().then((data) => {
        if (data) setSessions(data)
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <main className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-semibold tracking-tight'>
          Stratus Dashboard
        </h1>
        <p className='text-sm text-muted-foreground'>
          Last update: {lastUpdate ? formatLocalClock(lastUpdate) : "N/A"}
        </p>
      </header>

      <h1 className='text-2xl font-semibold tracking-tight'>
        Active Sessions
      </h1>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {sessions.map((session, i) => (
          <article
            key={i}
            className='rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm'
          >
            <div className='mb-3 flex items-start justify-between gap-3'>
              <h2 className='text-lg font-semibold'>{ session.sessionId.split('-')[0]}</h2>
              <span className='text-xs text-muted-foreground'>
                {session.start
                  ? formatDuration((Date.now()/1000) - session.start)
                  : "N/A"}
              </span>
            </div>

            <dl className='grid gap-2 text-sm sm:grid-cols-2'>
              <div>
                <dt className='text-muted-foreground'>User</dt>
                <dd>{session.userName}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>Game</dt>
                <dd>{session.gameId.split('-')[0]}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>Node</dt>
                <dd>{session.node}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>Dimensions</dt>
                <dd>{session.width}x{session.height}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <h1 className='text-2xl font-semibold tracking-tight'>
        Active Servers
      </h1>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {nodes.map((node, i) => (
          <article
            key={i}
            className='rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm'
          >
            <div className='mb-3 flex items-start justify-between gap-3'>
              <h2 className='text-lg font-semibold'>{node.name}</h2>
              <span className='text-xs text-muted-foreground'>
                {formatDuration(node.payload.uptime)}
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
                  <dt className='text-muted-foreground'>CPU load</dt>
                  <dd>
                    {node.payload.cpu_load.toFixed(3)} /{" "}
                    {node.payload.cpu_count.toFixed(0)} cores
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>RAM</dt>
                  <dd>
                    {formatBytes(node.payload.ram_used)} /{" "}
                    {formatBytes(node.payload.ram_total)} GB
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Disk</dt>
                  <dd>
                    {formatBytes(node.payload.disk_used)} /{" "}
                    {formatBytes(node.payload.disk_total)} GB
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Temperature</dt>
                  <dd>{node.payload.temperature}°C</dd>
                </div>
                <div className='sm:col-span-2'>
                  <dt className='text-muted-foreground'>Games</dt>
                  <dd>{node.payload.games.map(id => id.split('-')[0]).join(", ")}</dd>
                </div>
                <div className='sm:col-span-2'>
                  <dt className='text-muted-foreground'>Sessions</dt>
                  <dd>{node.payload.sessions.map(id => id.split('-')[0])}</dd>
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

  return `${hours}:${minutes}:${seconds}.${fraction} [${timeZone}]`
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

function formatBytes(bytes: number) {
  return (bytes / 10 ** 9).toFixed(3)
}
