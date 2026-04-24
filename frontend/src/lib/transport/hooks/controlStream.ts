import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"
import { closeWriterSafely } from "./writer"

export function useControlStream() {
  const { addLogEvent } = useLogs()

  const [controlStreamWriter, setControlStreamWriter] =
    useState<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const controlStreamWriterRef =
    useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)

  const closeWriter = useCallback(
    async (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      await closeWriterSafely(writer, (error) => {
        addLogEvent(
          "CONTROL",
          `Control writer close warning: ${(error as Error).message}`,
          "error",
        )
      })
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
