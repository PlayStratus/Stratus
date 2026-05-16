import { useCallback, useEffect, useRef } from "react"

import { useLogs } from "./logs"
import { TransportMediaStream } from "../utils/transportMediaStream"
import { StatusType } from "../types"

export function useVideoStream(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setStatus: React.Dispatch<React.SetStateAction<StatusType>>,
  setAverageRenderTimeMs?: React.Dispatch<React.SetStateAction<number>>,
  setFps?: React.Dispatch<React.SetStateAction<number>>,
) {
  const { addLogEvent } = useLogs()
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<TransportMediaStream | null>(null)
  const isUnmountedRef = useRef(false)

  const getWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current
    }

    const canvas = canvasRef.current
    if (!canvas?.transferControlToOffscreen) {
      addLogEvent("VIDEO", "OffscreenCanvas is not available", "error")
      return null
    }

    const worker = new Worker(
      new URL("./videoStream.worker.ts", import.meta.url),
      { type: "module" },
    )

    worker.onmessage = (event: MessageEvent<any>) => {
      const message = event.data

      if (message.type === "status") {
        setStatus(message.status)
      } else if (message.type === "metrics") {
        setAverageRenderTimeMs?.(message.averageRenderTimeMs)
        setFps?.(message.fps)
      } else if (message.type === "log") {
        addLogEvent("VIDEO", message.message, message.severity)
      } else if (message.type === "error") {
        addLogEvent("VIDEO", message.message, "error")
      }
    }

    worker.onerror = (event) => {
      if (!isUnmountedRef.current) {
        addLogEvent("VIDEO", event.message || "Video worker error", "error")
      }
    }

    const offscreenCanvas = canvas.transferControlToOffscreen()
    worker.postMessage({ type: "init", canvas: offscreenCanvas }, [
      offscreenCanvas,
    ])
    workerRef.current = worker
    addLogEvent("VIDEO", "Video worker started")

    return worker
  }, [addLogEvent, canvasRef, setAverageRenderTimeMs, setFps, setStatus])

  const getStream = useCallback(
    (worker: Worker) => {
      if (streamRef.current) {
        return streamRef.current
      }

      const stream = new TransportMediaStream({
        worker,
        label: "Video",
        onOpen: () => addLogEvent("VIDEO", "Video stream opened"),
        onClose: () => addLogEvent("VIDEO", "Video stream closed"),
        onError: (message) => addLogEvent("VIDEO", message, "error"),
        isClosed: () => isUnmountedRef.current,
      })

      streamRef.current = stream
      return stream
    },
    [addLogEvent],
  )

  const handleVideoStreams = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      initialChunk: Uint8Array,
    ) => {
      const worker = getWorker()
      if (!worker) {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
        return
      }

      await getStream(worker).start(reader, initialChunk)
    },
    [getStream, getWorker],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      streamRef.current?.close()
      streamRef.current = null
      workerRef.current?.postMessage({ type: "close" })
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return { handleVideoStreams }
}
