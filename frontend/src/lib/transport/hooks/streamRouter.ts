import { useCallback, useEffect, useRef } from "react"

import { useLogs } from "./logs"

import { TransportStreamType } from "../types"

type StreamHandlers = {
  handleControlStream: (transport: WebTransport) => Promise<void> | void
  handleVideoStreams: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    initialChunk: Uint8Array,
  ) => Promise<void> | void
  handleAudioStreams: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    initialChunk: Uint8Array,
  ) => Promise<void> | void
  handleInputStream: (transport: WebTransport) => Promise<void> | void
}

export function useStreamRouter() {
  const { addLogEvent } = useLogs()
  const incomingStreamReaderRef = useRef<ReadableStreamDefaultReader<
    ReadableStream<Uint8Array>
  > | null>(null)
  const pendingStreamReadersRef = useRef<
    Set<ReadableStreamDefaultReader<Uint8Array>>
  >(new Set())
  const isUnmountedRef = useRef(false)

  const readFirstChunk = useCallback(
    async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
      while (true) {
        const { value, done } = await reader.read()

        if (done) {
          return null
        }

        if (value && value.length > 0) {
          return value
        }
      }
    },
    [],
  )

  const routeIncomingStream = useCallback(
    async (stream: ReadableStream<Uint8Array>, handlers: StreamHandlers) => {
      const reader = stream.getReader()
      pendingStreamReadersRef.current.add(reader)
      let handedOff = false

      try {
        const initialChunk = await readFirstChunk(reader)
        if (!initialChunk) {
          addLogEvent(
            "ROUTER",
            "Incoming stream closed before a stream type byte was received.",
            "warn",
          )
          return
        }

        const streamType = initialChunk[0] as TransportStreamType
        const streamTypeLabel = TransportStreamType[streamType] ?? streamType

        addLogEvent(
          "ROUTER",
          `Received new stream with type ${streamTypeLabel}.`,
          "info",
        )

        switch (streamType) {
          case TransportStreamType.Stream_Video:
            handedOff = true
            pendingStreamReadersRef.current.delete(reader)
            await handlers.handleVideoStreams(reader, initialChunk)
            break
          case TransportStreamType.Stream_Audio:
            handedOff = true
            pendingStreamReadersRef.current.delete(reader)
            await handlers.handleAudioStreams(reader, initialChunk)
            break
          default:
            addLogEvent(
              "ROUTER",
              `Unknown stream type ${streamType}; closing stream.`,
              "warn",
            )
            break
        }
      } catch (error) {
        if (isUnmountedRef.current) return

        const errorMessage = `Error routing stream: ${(error as Error).message}`
        addLogEvent("ROUTER", errorMessage, "error")
      } finally {
        if (!handedOff) {
          await reader.cancel().catch(() => undefined)
          reader.releaseLock()
        }

        pendingStreamReadersRef.current.delete(reader)
      }
    },
    [addLogEvent, readFirstChunk],
  )

  const handleStream = useCallback(
    async (transport: WebTransport, handlers: StreamHandlers) => {
      if (incomingStreamReaderRef.current) {
        addLogEvent(
          "ROUTER",
          "Already listening for incoming unidirectional streams.",
          "warn",
        )
        return
      }

      await handlers.handleControlStream(transport)
      await handlers.handleInputStream(transport)

      const reader = transport.incomingUnidirectionalStreams.getReader()
      incomingStreamReaderRef.current = reader

      try {
        addLogEvent("ROUTER", "Listening for incoming unidirectional streams.")

        while (true) {
          const { value: stream, done } = await reader.read()
          if (done) {
            addLogEvent(
              "ROUTER",
              "Done accepting incoming unidirectional streams.",
            )
            return
          }

          if (!stream) {
            continue
          }

          void routeIncomingStream(stream, handlers)
        }
      } catch (error) {
        if (isUnmountedRef.current) return

        const errorMessage = `Error accepting streams: ${
          (error as Error).message
        }`
        addLogEvent("ROUTER", errorMessage, "error")
      } finally {
        incomingStreamReaderRef.current = null
        reader.releaseLock()
      }
    },
    [addLogEvent, routeIncomingStream],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true

      const incomingReader = incomingStreamReaderRef.current
      if (incomingReader) {
        void incomingReader.cancel().catch(() => undefined)
      }

      pendingStreamReadersRef.current.forEach((reader) => {
        void reader.cancel().catch(() => undefined)
      })
      pendingStreamReadersRef.current.clear()
    }
  }, [])

  return { handleStream }
}
