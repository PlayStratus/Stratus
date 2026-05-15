import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"
import { closeWriterSafely, releaseWriterLock } from "../utils/writer"

type ManualAxisXValue = -1 | 0 | 1

const DEFAULT_GAMEPAD_BUTTON_COUNT = 17
const DEFAULT_GAMEPAD_AXIS_COUNT = 4
const LEFT_JOYSTICK_X_AXIS_INDEX = 0

export function useInputStream() {
  const { addLogEvent } = useLogs()

  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const manualAxisXRef = useRef<ManualAxisXValue>(0)
  const [isInputReady, setIsInputReady] = useState(false)

  useEffect(() => {
    addLogEvent(
      "INPUT",
      `Input hook mounted. ${getInputEnvironmentSummary()}`,
      "info",
    )

    const handleGamepadConnected = (event: GamepadEvent) => {
      addLogEvent(
        "INPUT",
        `Gamepad connected: index=${event.gamepad.index} id="${event.gamepad.id}" buttons=${event.gamepad.buttons.length} axes=${event.gamepad.axes.length}.`,
        "info",
      )
    }

    const handleGamepadDisconnected = (event: GamepadEvent) => {
      addLogEvent(
        "INPUT",
        `Gamepad disconnected: index=${event.gamepad.index} id="${event.gamepad.id}".`,
        "warn",
      )
    }

    const handleVisibilityChange = () => {
      addLogEvent(
        "INPUT",
        `Document visibility changed to ${document.visibilityState}.`,
        document.visibilityState === "visible" ? "info" : "warn",
      )
    }

    window.addEventListener("gamepadconnected", handleGamepadConnected)
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      addLogEvent("INPUT", "Input hook unmounted.", "info")
      window.removeEventListener("gamepadconnected", handleGamepadConnected)
      window.removeEventListener(
        "gamepaddisconnected",
        handleGamepadDisconnected,
      )
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [addLogEvent])

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
        addLogEvent(
          "INPUT",
          "Input stream setup skipped because a writer already exists.",
          "warn",
        )
        return
      }

      try {
        addLogEvent("INPUT", "Creating input unidirectional stream.", "info")
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

  const setManualAxisX = useCallback(
    (nextAxisX: ManualAxisXValue) => {
      if (manualAxisXRef.current !== nextAxisX) {
        addLogEvent("INPUT", `Manual X axis set to ${nextAxisX}.`, "info")
      }
      manualAxisXRef.current = nextAxisX
    },
    [addLogEvent],
  )

  useEffect(() => {
    if (!isInputReady) return

    let rafId = 0
    let disposed = false
    const encoder = new TextEncoder()
    const getGamepads =
      typeof navigator.getGamepads === "function"
        ? navigator.getGamepads.bind(navigator)
        : null
    let lastSentPayload = ""
    let frameCount = 0
    let sentCount = 0
    let noGamepadLogged = false
    let lastGamepadSummary = ""

    addLogEvent(
      "INPUT",
      `Input loop starting. getGamepads=${Boolean(getGamepads)} ready=${isInputReady}.`,
      "info",
    )

    const loop = async () => {
      if (disposed) return
      const writer = writerRef.current

      if (writer) {
        frameCount += 1
        let gamepads: readonly (Gamepad | null)[] = []
        try {
          gamepads = getGamepads?.() ?? []
        } catch (error) {
          addLogEvent(
            "INPUT",
            `navigator.getGamepads threw: ${(error as Error).message}`,
            "error",
          )
        }
        const gp = gamepads[0]

        if (!gp && !noGamepadLogged) {
          noGamepadLogged = true
          addLogEvent(
            "INPUT",
            `No gamepad found at index 0. gamepadSlots=${gamepads.length} manualAxisX=${manualAxisXRef.current}.`,
            "warn",
          )
        }

        if (gp) {
          const gamepadSummary = `index=${gp.index} id="${gp.id}" connected=${gp.connected} buttons=${gp.buttons.length} axes=${gp.axes.length} timestamp=${gp.timestamp}`
          if (gamepadSummary !== lastGamepadSummary) {
            addLogEvent("INPUT", `Polling gamepad: ${gamepadSummary}.`, "info")
            lastGamepadSummary = gamepadSummary
          }
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
            sentCount += 1

            addLogEvent(
              "INPUT",
              `Sent input #${sentCount} frame=${frameCount}: ${summarizePayload(buttons, axes)} payload=${payload}`,
              "info",
            )
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
      addLogEvent(
        "INPUT",
        `Input loop stopping after ${frameCount} frames and ${sentCount} sends.`,
        "info",
      )
      disposed = true
      cancelAnimationFrame(rafId)
    }
  }, [addLogEvent, clearWriter, isInputReady])

  useEffect(() => {
    return () => {
      const writer = writerRef.current
      writerRef.current = null
      setIsInputReady(false)
      addLogEvent("INPUT", "Input stream cleanup closing writer.", "info")
      void closeWriter(writer)
      manualAxisXRef.current = 0
    }
  }, [addLogEvent, closeWriter])

  return { handleInputStream, setManualAxisX }
}

function getInputEnvironmentSummary() {
  return [
    `userAgent="${navigator.userAgent}"`,
    `platform="${navigator.platform}"`,
    `maxTouchPoints=${navigator.maxTouchPoints}`,
    `getGamepads=${typeof navigator.getGamepads === "function"}`,
    `GamepadEvent=${typeof GamepadEvent !== "undefined"}`,
    `PointerEvent=${typeof PointerEvent !== "undefined"}`,
    `TouchEvent=${typeof TouchEvent !== "undefined"}`,
  ].join(" ")
}

function summarizePayload(buttons: number[], axes: number[]) {
  const pressedButtons = buttons
    .map((value, index) => (value >= 0.5 ? index : null))
    .filter((value): value is number => value !== null)

  return `pressed=[${pressedButtons.join(",")}] axes=[${axes
    .map((axis) => axis.toFixed(3))
    .join(",")}]`
}
