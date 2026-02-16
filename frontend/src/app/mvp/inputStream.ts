import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"

export function useInputStream() {
  const { addLogEvent: addLogEventFromContext } = useLogs()

  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const [isInputReady, setIsInputReady] = useState(false)

  const closeWriter = useCallback(
    async (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      if (!writer) return
      try {
        await writer.close()
      } catch (error) {
        addLogEventFromContext(
          `Input writer close warning: ${(error as Error).message}`,
          "error",
        )
      } finally {
        writer.releaseLock()
      }
    },
    [addLogEventFromContext],
  )

  const handleInputStream = useCallback(
    async (transport: WebTransport) => {
      if (writerRef.current) {
        return
      }

      try {
        const stream = await transport.createUnidirectionalStream()
        const writer = stream.getWriter()
        writerRef.current = writer
        setIsInputReady(true)
        addLogEventFromContext("Input unidirectional stream created.")
      } catch (error) {
        addLogEventFromContext(
          `Input Stream Error: ${(error as Error).message}`,
          "error",
        )
      }
    },
    [addLogEventFromContext],
  )

  useEffect(() => {
    if (!isInputReady) return

    let rafId = 0
    let disposed = false
    const encoder = new TextEncoder()
    let lastSentPayload = ""

    const loop = async () => {
      if (disposed) return
      const gamepads = navigator.getGamepads()
      const gp = gamepads[0]
      const writer = writerRef.current

      if (gp && writer) {
        const payload = JSON.stringify({
          type: "gamepad",
          buttons: gp.buttons.map((button) => button.value),
          axes: gp.axes.map((axis) => Number(axis.toFixed(3))),
        })

        if (payload !== lastSentPayload) {
          try {
            await writer.ready
            await writer.write(encoder.encode(payload))
            lastSentPayload = payload
          } catch (error) {
            addLogEventFromContext(
              `Input write error: ${(error as Error).message}`,
              "error",
            )
          }
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
    }
  }, [addLogEventFromContext, isInputReady])

  useEffect(() => {
    return () => {
      void closeWriter(writerRef.current)
      writerRef.current = null
    }
  }, [closeWriter])

  return { handleInputStream }
}
