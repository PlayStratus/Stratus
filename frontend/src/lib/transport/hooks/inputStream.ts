import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"
import { closeWriterSafely, releaseWriterLock } from "../utils/writer"

const DEFAULT_GAMEPAD_BUTTON_COUNT = 17
const DEFAULT_GAMEPAD_AXIS_COUNT = 4
const IGNORED_GAMEPAD_IDS = new Set(["stratus (Vendor: 0000 Product: 0000)"])

type TrackedGamepad = {
  clientIndex: number
}

type GamepadState = {
  clientIndex: number
  buttons: number[]
  axes: number[]
}

function getConnectedGamepads() {
  if (typeof navigator.getGamepads !== "function") {
    return []
  }

  return Array.from(navigator.getGamepads()).filter(
    (gamepad): gamepad is Gamepad =>
      Boolean(gamepad && gamepad.connected && !isIgnoredGamepad(gamepad)),
  )
}

function isIgnoredGamepad(gamepad: Gamepad) {
  return IGNORED_GAMEPAD_IDS.has(gamepad.id)
}

function applyManualButtons(
  buttons: number[],
  manualButtonIndices: Set<number>,
) {
  manualButtonIndices.forEach((buttonIndex) => {
    if (buttonIndex >= DEFAULT_GAMEPAD_BUTTON_COUNT) {
      return
    }

    buttons[buttonIndex] = 1
  })
}

function createGamepadState(
  gamepad: Gamepad,
  clientIndex: number,
  manualButtonIndices: Set<number>,
): GamepadState {
  const buttons = Array.from(
    { length: DEFAULT_GAMEPAD_BUTTON_COUNT },
    (_, index) => ((gamepad.buttons[index]?.value ?? 0) >= 0.5 ? 1 : 0),
  )
  const axes = Array.from(
    { length: DEFAULT_GAMEPAD_AXIS_COUNT },
    (_, index) => gamepad.axes[index] ?? 0,
  )

  if (clientIndex === 0) {
    applyManualButtons(buttons, manualButtonIndices)
  }

  return { clientIndex, buttons, axes }
}

function createNeutralGamepadState(clientIndex: number): GamepadState {
  return {
    clientIndex,
    buttons: new Array(DEFAULT_GAMEPAD_BUTTON_COUNT).fill(0),
    axes: new Array(DEFAULT_GAMEPAD_AXIS_COUNT).fill(0),
  }
}

function createVirtualManualGamepadState(
  manualButtonIndices: Set<number>,
): GamepadState | null {
  if (manualButtonIndices.size === 0) {
    return null
  }

  const buttons = new Array(DEFAULT_GAMEPAD_BUTTON_COUNT).fill(0)
  const axes = new Array(DEFAULT_GAMEPAD_AXIS_COUNT).fill(0)

  applyManualButtons(buttons, manualButtonIndices)

  return { clientIndex: 0, buttons, axes }
}

function assertByte(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${label} must fit in one byte.`)
  }
}

function encodeGamepadState(state: GamepadState) {
  assertByte(state.clientIndex, "Gamepad index")

  const payload = new Uint8Array(
    1 + DEFAULT_GAMEPAD_BUTTON_COUNT + DEFAULT_GAMEPAD_AXIS_COUNT * 4,
  )
  const view = new DataView(payload.buffer)
  let offset = 0

  view.setUint8(offset, state.clientIndex)
  offset += 1

  for (let index = 0; index < DEFAULT_GAMEPAD_BUTTON_COUNT; index += 1) {
    view.setUint8(offset, (state.buttons[index] ?? 0) >= 0.5 ? 1 : 0)
    offset += 1
  }

  for (let index = 0; index < DEFAULT_GAMEPAD_AXIS_COUNT; index += 1) {
    view.setFloat32(offset, state.axes[index] ?? 0, true)
    offset += 4
  }

  return payload
}

function arePacketsEqual(left: Uint8Array | undefined, right: Uint8Array) {
  if (!left || left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function releaseClientGamepadIndex(
  availableClientGamepadIndexes: number[],
  clientIndex: number,
) {
  if (availableClientGamepadIndexes.includes(clientIndex)) {
    return
  }

  availableClientGamepadIndexes.push(clientIndex)
  availableClientGamepadIndexes.sort((left, right) => left - right)
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
      if (isIgnoredGamepad(event.gamepad)) {
        return
      }

      addLogEvent(
        "INPUT",
        `Gamepad connected: ${event.gamepad.id} (index ${event.gamepad.index})`,
      )
    }

    const handleGamepadDisconnected = (event: GamepadEvent) => {
      if (isIgnoredGamepad(event.gamepad)) {
        return
      }

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
    let nextClientGamepadIndex = 0
    const availableClientGamepadIndexes: number[] = []
    const trackedGamepads = new Map<number, TrackedGamepad>()
    const lastSentPackets = new Map<number, Uint8Array>()
    let lastConnectedBrowserIndexes = ""

    const getNextClientGamepadIndex = () => {
      return availableClientGamepadIndexes.shift() ?? nextClientGamepadIndex++
    }

    const sendStateIfChanged = async (
      writer: WritableStreamDefaultWriter<Uint8Array>,
      state: GamepadState,
    ) => {
      const payload = encodeGamepadState(state)
      const lastSentPacket = lastSentPackets.get(state.clientIndex)

      if (arePacketsEqual(lastSentPacket, payload)) {
        return
      }

      await writer.ready
      await writer.write(payload)
      lastSentPackets.set(state.clientIndex, payload)

      addLogEvent(
        "INPUT",
        `Sent input packet for gamepad ${state.clientIndex}: ${payload.length} bytes`,
        "info",
      )
    }

    const loop = async () => {
      if (disposed) return
      const writer = writerRef.current

      if (writer) {
        try {
          const gamepads = getConnectedGamepads()
          const connectedBrowserIndexes = new Set(
            gamepads.map((gamepad) => gamepad.index),
          )
          const connectedBrowserIndexLog = gamepads
            .map((gamepad) => gamepad.index)
            .sort((left, right) => left - right)
            .join(",")

          if (connectedBrowserIndexLog !== lastConnectedBrowserIndexes) {
            lastConnectedBrowserIndexes = connectedBrowserIndexLog

            addLogEvent(
              "INPUT",
              gamepads.length > 0
                ? `Polling ${gamepads.length} gamepad(s): ${connectedBrowserIndexLog}`
                : "No connected gamepad detected.",
              "info",
            )
          }

          for (const [browserIndex, tracked] of trackedGamepads) {
            if (connectedBrowserIndexes.has(browserIndex)) {
              continue
            }

            await sendStateIfChanged(
              writer,
              createNeutralGamepadState(tracked.clientIndex),
            )
            trackedGamepads.delete(browserIndex)
            releaseClientGamepadIndex(
              availableClientGamepadIndexes,
              tracked.clientIndex,
            )

            addLogEvent(
              "INPUT",
              `Released gamepad ${tracked.clientIndex} from browser index ${browserIndex}`,
              "info",
            )
          }

          for (const gamepad of gamepads) {
            let tracked = trackedGamepads.get(gamepad.index)

            if (!tracked) {
              tracked = {
                clientIndex: getNextClientGamepadIndex(),
              }
              trackedGamepads.set(gamepad.index, tracked)

              addLogEvent(
                "INPUT",
                `Assigned gamepad ${tracked.clientIndex} to ${gamepad.id} (browser index ${gamepad.index})`,
                "info",
              )
            }

            const state = createGamepadState(
              gamepad,
              tracked.clientIndex,
              manualButtonIndicesRef.current,
            )

            await sendStateIfChanged(writer, state)
          }

          if (gamepads.length === 0) {
            await sendStateIfChanged(
              writer,
              createVirtualManualGamepadState(manualButtonIndicesRef.current) ??
                createNeutralGamepadState(0),
            )
          }
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
