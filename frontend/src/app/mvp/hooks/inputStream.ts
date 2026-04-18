import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"

type ManualAxisXValue = -1 | 0 | 1

const DEFAULT_GAMEPAD_BUTTON_COUNT = 17
const DEFAULT_GAMEPAD_AXIS_COUNT = 4
const LEFT_JOYSTICK_X_AXIS_INDEX = 0

export function useInputStream() {
  const { addLogEvent } = useLogs()

  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const manualAxisXRef = useRef<ManualAxisXValue>(0)
  const [isInputReady, setIsInputReady] = useState(false)

  const closeWriter = useCallback(
    async (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      if (!writer) return
      try {
        await writer.close()
      } catch (error) {
        addLogEvent(
          "INPUT",
          `Input writer close warning: ${(error as Error).message}`,
          "error",
        )
      } finally {
        writer.releaseLock()
      }
    },
    [addLogEvent],
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
        addLogEvent("INPUT", "Input unidirectional stream created.")
      } catch (error) {
        addLogEvent(
          "INPUT",
          `Input Stream Error: ${(error as Error).message}`,
          "error",
        )
      }
    },
    [addLogEvent],
  )

  const setManualAxisX = useCallback((nextAxisX: ManualAxisXValue) => {
    manualAxisXRef.current = nextAxisX
  }, [])

  useEffect(() => {
    if (!isInputReady) return

    let rafId = 0
    let disposed = false
    const encoder = new TextEncoder()
    let lastSentPayload = ""

    const loop = async () => {
      if (disposed) return
      const writer = writerRef.current

      if (writer) {
        const gamepads = navigator.getGamepads()
        const gp = gamepads[0]
        const buttons = gp
          ? gp.buttons.map((button) => button.value)
          : ([] as number[])
        const axes = gp
          ? gp.axes.map((axis) => Number(axis.toFixed(3)))
          : ([] as number[])

        while (buttons.length < DEFAULT_GAMEPAD_BUTTON_COUNT) {
          buttons.push(0)
        }

        while (axes.length < DEFAULT_GAMEPAD_AXIS_COUNT) {
          axes.push(0)
        }

        // On-screen controls temporarily override only the left joystick X axis.
        if (manualAxisXRef.current !== 0) {
          axes[LEFT_JOYSTICK_X_AXIS_INDEX] = manualAxisXRef.current
        }

        const payload = JSON.stringify({
          type: "gamepad",
          buttons,
          axes,
        })

        if (payload !== lastSentPayload) {
          try {
            await writer.ready
            await writer.write(encoder.encode(payload))
            lastSentPayload = payload

            addLogEvent("INPUT", `Sent input string: ${payload}`, "info")
          } catch (error) {
            addLogEvent(
              "INPUT",
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
  }, [addLogEvent, isInputReady])

  useEffect(() => {
    return () => {
      void closeWriter(writerRef.current)
      writerRef.current = null
      manualAxisXRef.current = 0
    }
  }, [closeWriter])

  return { handleInputStream, setManualAxisX }
}
