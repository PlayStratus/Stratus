import { useCallback, useEffect, useRef } from "react"

import { useLogs } from "./logs"
import { StatusType } from "../ClientPage"

const MAX_CHUNK_BATCH_COUNT = 8
const MAX_CHUNK_BATCH_BYTES = 128 * 1024
const CHUNK_BATCH_DELAY_MS = 8

export function useVideoStream(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setStatus: React.Dispatch<React.SetStateAction<StatusType>>,
) {
  const { addLogEvent } = useLogs()
  const streamNumberRef = useRef<number>(1)
  const workerRef = useRef<Worker | null>(null)
  const incomingStreamReaderRef = useRef<ReadableStreamDefaultReader<
    ReadableStream<Uint8Array>
  > | null>(null)
  const streamReadersRef = useRef<Set<ReadableStreamDefaultReader<Uint8Array>>>(
    new Set(),
  )
  const isUnmountedRef = useRef(false)

  const getWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current
    }

    if (typeof Worker === "undefined") {
      addLogEvent("VIDEO", "Worker API not available in this browser", "error")
      return null
    }

    const canvas = canvasRef.current
    if (!canvas) {
      addLogEvent("VIDEO", "Canvas not ready for worker rendering", "error")
      return null
    }

    if (typeof canvas.transferControlToOffscreen !== "function") {
      addLogEvent("VIDEO", "OffscreenCanvas transfer is not available", "error")
      return null
    }

    const worker = new Worker(
      new URL("./videoStream.worker.ts", import.meta.url),
      {
        type: "module",
      },
    )

    worker.onmessage = (event: MessageEvent<any>) => {
      const message = event.data

      if (message.type === "log") {
        addLogEvent("VIDEO", message.message, message.severity)
        return
      }

      if (message.type === "status") {
        setStatus(message.status)
      }
    }

    worker.onerror = (event) => {
      if (isUnmountedRef.current) return
      addLogEvent(
        "VIDEO",
        `Video worker error: ${event.message || "Unknown worker error"}`,
        "error",
      )
    }

    const offscreenCanvas = canvas.transferControlToOffscreen()
    worker.postMessage({ type: "init", canvas: offscreenCanvas }, [
      offscreenCanvas,
    ])

    workerRef.current = worker
    return worker
  }, [addLogEvent, canvasRef, setStatus])

  const readFromIncomingStream = useCallback(
    async (stream: ReadableStream<Uint8Array>, number: number) => {
      const worker = getWorker()
      if (!worker) {
        addLogEvent(
          "VIDEO",
          "No video worker available; cannot read stream",
          "error",
        )
        return
      }

      const reader = stream.getReader()
      streamReadersRef.current.add(reader)
      worker.postMessage({ type: "stream-start", stream: number })
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
        worker.postMessage(
          { type: "chunk-batch", stream: number, chunks },
          chunks,
        )
      }

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            if (flushTimeoutId) {
              clearTimeout(flushTimeoutId)
              flushPendingChunks()
            } else if (pendingChunks.length > 0) {
              flushPendingChunks()
            }
            addLogEvent("VIDEO", "Stream #" + number + " closed")
            worker.postMessage({ type: "stream-end", stream: number })
            return
          }
          if (!value || value.length === 0) continue

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
            continue
          }

          if (!flushTimeoutId) {
            flushTimeoutId = setTimeout(() => {
              flushPendingChunks()
            }, CHUNK_BATCH_DELAY_MS)
          }
        }
      } catch (e) {
        if (isUnmountedRef.current) return
        const errorMessage = e instanceof Error ? e.message : String(e)
        addLogEvent(
          "VIDEO",
          "Error while reading from stream #" + number + ": " + errorMessage,
          "error",
        )
      } finally {
        if (flushTimeoutId) {
          clearTimeout(flushTimeoutId)
          flushPendingChunks()
        }
        streamReadersRef.current.delete(reader)
        reader.releaseLock()
      }
    },
    [addLogEvent, getWorker],
  )

  const handleVideoStreams = useCallback(
    async (transport: WebTransport) => {
      if (incomingStreamReaderRef.current) {
        return
      }

      const reader = transport.incomingUnidirectionalStreams.getReader()
      incomingStreamReaderRef.current = reader

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            incomingStreamReaderRef.current = null
            addLogEvent("VIDEO", "Done accepting unidirectional streams!")
            return
          }

          const stream = value
          const number = streamNumberRef.current++
          addLogEvent("VIDEO", "New incoming unidirectional stream #" + number)
          void readFromIncomingStream(stream, number)
        }
      } catch (e) {
        if (isUnmountedRef.current) return
        const errorMessage = e instanceof Error ? e.message : String(e)
        addLogEvent(
          "VIDEO",
          "Error while accepting streams: " + errorMessage,
          "error",
        )
      } finally {
        incomingStreamReaderRef.current = null
        reader.releaseLock()
      }
    },
    [addLogEvent, readFromIncomingStream],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true

      const incomingReader = incomingStreamReaderRef.current
      if (incomingReader) {
        void incomingReader.cancel().catch(() => undefined)
      }

      streamReadersRef.current.forEach((reader) => {
        void reader.cancel().catch(() => undefined)
      })
      streamReadersRef.current.clear()

      const worker = workerRef.current
      workerRef.current = null
      if (worker) {
        worker.postMessage({ type: "close" })
        worker.terminate()
      }
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
