"use client"

import { useEffect, useRef, useState } from "react"

import { LogsProvider, useLogs } from "./logs"
import { useTransport } from "./transport"
import { useVideoStream } from "./videoStream"
import { useControlStream } from "./controlStream"
import { useInputStream } from "./inputStream"

import Loading from "./Loading"
import LogsPanel from "./LogsPanel"
import FullScreenButton from "./FullScreenButton"

export type StatusType =
  | "loading"
  | "connected"
  | "streaming"
  | "disconnected"
  | "error"

function MVPPage() {
  const [status, setStatus] = useState<StatusType>("loading")

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasStartedRef = useRef(false)

  const { logs } = useLogs()

  const { handleConnecting } = useTransport(setStatus)
  const { handleControlStream } = useControlStream(canvasRef)
  const { handleVideoStreams } = useVideoStream(canvasRef, setStatus)
  const { handleInputStream } = useInputStream()

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }
    hasStartedRef.current = true

    const handleMount = async () => {
      const connectedTransport = await handleConnecting()
      if (!connectedTransport) return

      await handleControlStream(connectedTransport)
      await handleInputStream(connectedTransport)
      await handleVideoStreams(connectedTransport)
    }

    void handleMount()
  }, [
    handleConnecting,
    handleControlStream,
    handleInputStream,
    handleVideoStreams,
  ])

  return (
    <>
      <FullScreenButton canvasRef={canvasRef} />

      <canvas ref={canvasRef} className='h-screen w-screen bg-black' />

      {status === "loading" && <Loading canvasRef={canvasRef} />}

      <LogsPanel logs={logs} />
    </>
  )
}

export default function PageWrapper() {
  return (
    <LogsProvider>
      <MVPPage />
    </LogsProvider>
  )
}
