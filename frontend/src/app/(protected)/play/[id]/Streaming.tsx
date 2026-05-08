import { Dispatch, SetStateAction, useEffect, useRef } from "react"

import { useStreamRouter } from "@/lib/transport/hooks/streamRouter"
import { useControlStream } from "@/lib/transport/hooks/controlStream"
import { useVideoStream } from "@/lib/transport/hooks/videoStream"
import { useAudioStream } from "@/lib/transport/hooks/audioStream"
import { useInputStream } from "@/lib/transport/hooks/inputStream"

import { StatusType } from "@/lib/transport/types"

type Props = {
  handleConnecting: (
    url: string,
    tlsFingerprint: string,
  ) => Promise<WebTransport | undefined>
  webtransportIP: string | null
  tlsFingerprint: string | null
  status: Exclude<StatusType, "NOT_STARTED" | "ERROR">
  setStatus: Dispatch<SetStateAction<StatusType>>
  setErrorMessage: (message: string | null) => Promise<void> | void
}

export default function Streaming({
  handleConnecting,
  webtransportIP,
  tlsFingerprint,
  status,
  setStatus,
  setErrorMessage,
}: Readonly<Props>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hasStartedRef = useRef(false)
  const isMountedRef = useRef(true)

  const { handleStream } = useStreamRouter()

  const { handleControlStream } = useControlStream()
  const { handleVideoStreams } = useVideoStream(canvasRef, setStatus)
  const { handleAudioStreams } = useAudioStream()
  const { handleInputStream } = useInputStream()

  useEffect(() => {
    isMountedRef.current = true

    if (status !== "LOADING") {
      return
    }

    if (!webtransportIP || !tlsFingerprint) {
      return
    }

    if (hasStartedRef.current) {
      return
    }
    hasStartedRef.current = true

    const handleMount = async () => {
      const url = `${webtransportIP}:443`

      const transport = await handleConnecting(url, tlsFingerprint)

      if (!transport || !isMountedRef.current) {
        return
      }

      if (!isMountedRef.current) {
        return
      }

      await handleStream(transport, {
        handleControlStream,
        handleVideoStreams,
        handleAudioStreams,
        handleInputStream,
      })

      if (!isMountedRef.current) {
        return
      }

      await setErrorMessage("Connection closed.")

      setStatus((previousStatus) =>
        previousStatus === "LOADING" ? "STREAMING" : previousStatus,
      )
    }

    void handleMount()

    return () => {
      isMountedRef.current = false
    }
  }, [
    handleConnecting,
    handleControlStream,
    handleStream,
    handleAudioStreams,
    handleInputStream,
    handleVideoStreams,
    setErrorMessage,
    tlsFingerprint,
    webtransportIP,
  ])

  return (
    <>
      {status === "LOADING" && <Loading />}
      <canvas
        className={
          `h-full w-full ` + (status === "STREAMING" ? "block" : "hidden")
        }
        ref={canvasRef}
      />
    </>
  )
}

export function LoadingScreen() {
  return (
    <div className='relative flex h-full w-full items-center justify-center overflow-hidden bg-black'>
      <video
        className='absolute inset-0 h-full w-full object-cover opacity-60'
        autoPlay
        muted
        loop
        playsInline
      >
        <source src='/loading.mp4' type='video/mp4' />
      </video>
    </div>
  )
}

function Loading() {
  return <LoadingScreen />
}
