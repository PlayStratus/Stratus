import { useCallback, useEffect, useRef } from "react"

import { useLogs } from "./logs"
import { StatusType } from "../types"

const MAX_CHUNK_BATCH_COUNT = 8
const MAX_CHUNK_BATCH_BYTES = 128 * 1024
const CHUNK_BATCH_DELAY_MS = 8

export function useVideoStream(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setStatus: React.Dispatch<React.SetStateAction<StatusType>>,
  setAverageRenderTimeMs?: React.Dispatch<React.SetStateAction<number>>,
  setFps?: React.Dispatch<React.SetStateAction<number>>,
) {
  const { addLogEvent } = useLogs()
  const workerRef = useRef<Worker | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
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

  const handleVideoStreams = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      initialChunk: Uint8Array,
    ) => {
      const worker = getWorker()
      if (!worker || readerRef.current) {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
        return
      }

      readerRef.current = reader

      let pendingChunks: ArrayBuffer[] = []
      let pendingChunkBytes = 0
      let flushTimeoutId: ReturnType<typeof setTimeout> | null = null

      const flushPendingChunks = () => {
        flushTimeoutId = null

        if (pendingChunks.length === 0) {
          return
        }

        const chunks = pendingChunks
        pendingChunks = []
        pendingChunkBytes = 0
        worker.postMessage({ type: "chunk-batch", chunks }, chunks)
      }

      const queueChunk = (value: Uint8Array) => {
        if (value.length === 0) {
          return
        }

        const chunk = toTransferableBuffer(value)
        pendingChunks.push(chunk)
        pendingChunkBytes += chunk.byteLength

        if (
          pendingChunks.length >= MAX_CHUNK_BATCH_COUNT ||
          pendingChunkBytes >= MAX_CHUNK_BATCH_BYTES
        ) {
          if (flushTimeoutId) {
            clearTimeout(flushTimeoutId)
          }
          flushPendingChunks()
          return
        }

        if (!flushTimeoutId) {
          flushTimeoutId = setTimeout(() => {
            flushPendingChunks()
          }, CHUNK_BATCH_DELAY_MS)
        }
      }

      try {
        addLogEvent("VIDEO", "Video stream opened")

        queueChunk(initialChunk)

        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            if (flushTimeoutId) {
              clearTimeout(flushTimeoutId)
              flushPendingChunks()
            } else if (pendingChunks.length > 0) {
              flushPendingChunks()
            }
            addLogEvent("VIDEO", "Video stream closed")
            return
          }
          if (!value?.length) continue

          queueChunk(value)
        }
      } catch (error) {
        if (!isUnmountedRef.current) {
          addLogEvent(
            "VIDEO",
            `Video stream error: ${(error as Error).message}`,
            "error",
          )
        }
      } finally {
        if (flushTimeoutId) {
          clearTimeout(flushTimeoutId)
          flushPendingChunks()
        }
        readerRef.current = null
        reader.releaseLock()
      }
    },
    [addLogEvent, getWorker],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      void readerRef.current?.cancel().catch(() => undefined)
      workerRef.current?.postMessage({ type: "close" })
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return { handleVideoStreams }
}

function toTransferableBuffer(value: Uint8Array) {
  if (
    value.buffer instanceof ArrayBuffer &&
    value.byteOffset === 0 &&
    value.byteLength === value.buffer.byteLength
  ) {
    return value.buffer
  }

  return value.slice().buffer
}
