"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { dumpLogs, LogsProvider, useLogs } from "./hooks/logs"
import { useTransport } from "./hooks/transport"
import { useVideoStream } from "./hooks/videoStream"
import { useControlStream } from "./hooks/controlStream"
import { useInputStream } from "./hooks/inputStream"

import Loading from "./Loading"
import InputButtons from "./InputButtons"

export type StatusType =
  | "loading"
  | "connected"
  | "streaming"
  | "disconnected"
  | "error"

type MVPPageProps = {
  url: string
  tlsCert: string
}

function MVPPage({ url, tlsCert }: Readonly<MVPPageProps>) {
  const [status, setStatus] = useState<StatusType>("loading")

  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasStartedRef = useRef(false)
  const hasRedirectedRef = useRef(false)

  const { logs } = useLogs()

  const { handleConnecting } = useTransport(
    url,
    tlsCert,
    setStatus,
    (errorMessage) => {
      if (hasRedirectedRef.current) {
        return
      }

      hasRedirectedRef.current = true

      const params = new URLSearchParams({
        url,
        tls_cert: tlsCert,
        error: errorMessage,
      })

      router.replace(`/mvp?${params.toString()}`)
    },
  )
  const { handleControlStream } = useControlStream()
  const { handleVideoStreams } = useVideoStream(canvasRef, setStatus)
  const { handleInputStream, setManualAxisX } = useInputStream()

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

  useEffect(() => {
    ;(globalThis as any).dumpLogs = () => dumpLogs(logs)
  }, [logs])

  const shouldShowLoading = status === "loading" || status === "connected"

  return (
    <>
      <canvas ref={canvasRef} className='h-screen w-screen bg-black' />

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
