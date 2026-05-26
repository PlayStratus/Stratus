import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"
import { closeWriterSafely, releaseWriterLock } from "../utils/writer"

const DEFAULT_GAMEPAD_BUTTON_COUNT = 17
const DEFAULT_GAMEPAD_AXIS_COUNT = 4

function getPrimaryGamepad() {
  if (typeof navigator.getGamepads !== "function") {
    return null
  }

  return (
    Array.from(navigator.getGamepads()).find((gamepad) => gamepad?.connected) ??
    null
  )
}

export function useInputStream() {
  const { addLogEvent } = useLogs()

  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const manualButtonIndicesRef = useRef(new Set<number>())
  const [isInputReady, setIsInputReady] = useState(false)

  const closeWriter = useCallback(
    async (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      await closeWriterSafely(writer, (error) => {
        addLogEvent(
          "INPUT",
          `Input writer close warning: ${(error as Error).message}`,
          "warn",
        )
      })
    },
    [addLogEvent],
  )

  const clearWriter = useCallback(
    (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      if (writer && writerRef.current === writer) {
        writerRef.current = null
      }
      setIsInputReady(false)
    },
    [],
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

  const setManualButton = useCallback(
    (buttonIndex: number, isPressed: boolean) => {
      if (!Number.isInteger(buttonIndex) || buttonIndex < 0) {
        return
      }

      if (isPressed) {
        manualButtonIndicesRef.current.add(buttonIndex)
        return
      }

      manualButtonIndicesRef.current.delete(buttonIndex)
    },
    [],
  )

  useEffect(() => {
    const handleGamepadConnected = (event: GamepadEvent) => {
      addLogEvent(
        "INPUT",
        `Gamepad connected: ${event.gamepad.id} (index ${event.gamepad.index})`,
      )
    }

    const handleGamepadDisconnected = (event: GamepadEvent) => {
      addLogEvent(
        "INPUT",
        `Gamepad disconnected: ${event.gamepad.id} (index ${event.gamepad.index})`,
      )
    }

    globalThis.addEventListener("gamepadconnected", handleGamepadConnected)
    globalThis.addEventListener(
      "gamepaddisconnected",
      handleGamepadDisconnected,
    )

    return () => {
      globalThis.removeEventListener("gamepadconnected", handleGamepadConnected)
      globalThis.removeEventListener(
        "gamepaddisconnected",
        handleGamepadDisconnected,
      )
    }
  }, [addLogEvent])

  useEffect(() => {
    if (!isInputReady) return

    let rafId = 0
    let disposed = false
    const encoder = new TextEncoder()
    let lastSentPayload = ""
    let lastGamepadIndex: number | null = null

    const loop = async () => {
      if (disposed) return
      const writer = writerRef.current

      if (writer) {
        const gp = getPrimaryGamepad()

        if (gp?.index !== lastGamepadIndex) {
          lastGamepadIndex = gp?.index ?? null

          addLogEvent(
            "INPUT",
            gp
              ? `Polling gamepad: ${gp.id} (index ${gp.index})`
              : "No connected gamepad detected.",
            "info",
          )
        }

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

        manualButtonIndicesRef.current.forEach((buttonIndex) => {
          while (buttons.length <= buttonIndex) {
            buttons.push(0)
          }

          buttons[buttonIndex] = 1
        })

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
            clearWriter(writer)
            releaseWriterLock(writer)
            disposed = true
            return
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
  }, [addLogEvent, clearWriter, isInputReady])

  useEffect(() => {
    return () => {
      const writer = writerRef.current
      writerRef.current = null
      setIsInputReady(false)
      void closeWriter(writer)
      manualButtonIndicesRef.current.clear()
    }
  }, [closeWriter])

  return { handleInputStream, setManualButton }
}
