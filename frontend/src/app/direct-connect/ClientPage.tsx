"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { dumpLogs, LogsProvider, useLogs } from "@/lib/transport/hooks/logs"
import { useTransport } from "@/lib/transport/hooks/transport"
import { useStreamRouter } from "@/lib/transport/hooks/streamRouter"
import { useVideoStream } from "@/lib/transport/hooks/videoStream"
import { useAudioStream } from "@/lib/transport/hooks/audioStream"
import { useControlStream } from "@/lib/transport/hooks/controlStream"
import { useInputStream } from "@/lib/transport/hooks/inputStream"

import Loading from "./Loading"
import InputButtons from "./InputButtons"

import { StatusType } from "@/lib/transport/types"

type MVPPageProps = {
  url: string
  tlsCert: string
}

function MVPPage({ url, tlsCert }: Readonly<MVPPageProps>) {
  const [status, setStatus] = useState<StatusType>("LOADING")
  const [averageRenderTimeMs, setAverageRenderTimeMs] = useState(0)
  const [fps, setFps] = useState(0)

  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasStartedRef = useRef(false)
  const hasRedirectedRef = useRef(false)

  const { logs, addLogEvent } = useLogs()

  const { handleConnecting } = useTransport((errorMessage: string) => {
    addLogEvent("TRANSPORT", errorMessage, "error")

    if (hasRedirectedRef.current) {
      return
    }

    hasRedirectedRef.current = true

    const params = new URLSearchParams({
      url,
      tls_cert: tlsCert,
      error: errorMessage,
    })

    router.replace(`/direct-connect?${params.toString()}`)
  })
  const { handleStream } = useStreamRouter()
  const { handleControlStream } = useControlStream()
  const { handleVideoStreams } = useVideoStream(
    canvasRef,
    setStatus,
    setAverageRenderTimeMs,
    setFps,
  )
  const { handleAudioStreams } = useAudioStream()
  const { handleInputStream, setManualAxisX } = useInputStream()

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }
    hasStartedRef.current = true

    const handleMount = async () => {
      const transport = await handleConnecting(url, tlsCert)
      if (!transport) return

      await handleStream(transport, {
        handleControlStream,
        handleVideoStreams,
        handleAudioStreams,
        handleInputStream,
      })
    }

    void handleMount()
  }, [
    handleConnecting,
    handleControlStream,
    handleStream,
    handleAudioStreams,
    handleInputStream,
    handleVideoStreams,
  ])

  useEffect(() => {
    ;(globalThis as any).dumpLogs = () => dumpLogs(logs)
  }, [logs])

  const shouldShowLoading = status === "LOADING"

  return (
    <>
      <canvas
        ref={canvasRef}
        className='h-screen w-screen bg-black'
        data-average-render-time-ms={averageRenderTimeMs}
        data-fps={fps}
      />

      <div className='fixed right-3 top-3 z-20 rounded bg-black/45 px-3 py-2 font-mono text-xs text-white/80'>
        <div>FPS: {fps.toFixed(1)}</div>
        <div>Avg render: {averageRenderTimeMs.toFixed(1)}ms</div>
      </div>

      <InputButtons onAxisXChange={setManualAxisX} />

      {shouldShowLoading && <Loading />}
    </>
  )
}

export default function ClientPage({ url, tlsCert }: Readonly<MVPPageProps>) {
  return (
    <LogsProvider>
      <MVPPage url={url} tlsCert={tlsCert} />
    </LogsProvider>
  )
}
