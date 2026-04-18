import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"

function isReleasedWriterError(error: unknown) {
  const message = (error as Error)?.message ?? ""
  return (
    message.toLowerCase().includes("writer") &&
    message.toLowerCase().includes("released")
  )
}

function isAlreadyClosingWriterError(error: unknown) {
  const message = ((error as Error)?.message ?? "").toLowerCase()
  return (
    message.includes("already been requested to be closed") ||
    message.includes("cannot close a writable stream that is closed") ||
    message.includes("cannot close a closed writable stream")
  )
}

export function useControlStream() {
  const { addLogEvent } = useLogs()

  const [controlStreamWriter, setControlStreamWriter] =
    useState<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const controlStreamWriterRef =
    useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)

  const closeWriter = useCallback(
    async (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      if (!writer) return
      try {
        await writer.close()
      } catch (error) {
        if (
          isReleasedWriterError(error) ||
          isAlreadyClosingWriterError(error)
        ) {
          return
        }
        addLogEvent(
          "CONTROL",
          `Control writer close warning: ${(error as Error).message}`,
          "error",
        )
      } finally {
        writer.releaseLock()
      }
    },
    [addLogEvent],
  )

  const handleControlStream = useCallback(
    async (transport: WebTransport) => {
      try {
        await closeWriter(controlStreamWriterRef.current)
        const stream = await transport.createBidirectionalStream()
        const writer = stream.writable.getWriter()
        addLogEvent("CONTROL", "Control bidirectional stream created.")
        controlStreamWriterRef.current = writer
        setControlStreamWriter(writer)
      } catch (error) {
        addLogEvent(
          "CONTROL",
          `Control Stream Error: ${(error as Error).message}`,
          "error",
        )
        return
      }
    },
    [addLogEvent, closeWriter],
  )

  useEffect(() => {
    controlStreamWriterRef.current = controlStreamWriter
  }, [controlStreamWriter])

  useEffect(() => {
    return () => {
      void closeWriter(controlStreamWriterRef.current)
      controlStreamWriterRef.current = null
    }
  }, [closeWriter])

  return { handleControlStream }
}
