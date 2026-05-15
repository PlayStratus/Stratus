"use client"

import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { useAuth } from "@/components/auth/AuthProvider"

import { getBackendPath } from "@/lib/backend/getBackendPath"
import { useAudioStream } from "@/lib/transport/hooks/audioStream"
import { dumpLogs, LogsProvider, useLogs } from "@/lib/transport/hooks/logs"
import { useTransport } from "@/lib/transport/hooks/transport"
import { StatusType } from "@/lib/transport/types"

import LandingForm from "./LandingForm"
import Streaming, { LoadingScreen } from "./Streaming"

const SESSION_ERROR_MESSAGE = "The game session could not be started."

type Props = {
  game: {
    id: string
    title: string
    developer: string
    coverImage: string | null
  }
}

function Client({ game }: Readonly<Props>) {
  const { token } = useAuth()

  const wrapperRef = useRef<HTMLDivElement>(null)

  const [webtransportIP, setWebtransportIP] = useState<string | null>(null)
  const [tlsFingerprint, setTlsFingerprint] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusType>("NOT_STARTED")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { logs, addLogEvent } = useLogs()
  const { handleConnecting, handleDisconnect } =
    useTransport(handleErrorMessage)
  const { handleAudioStreams, prepareAudioPlayback } = useAudioStream()

  useEffect(() => {
    const onChange = () => {
      addLogEvent(
        "PLAY",
        `Fullscreen changed. active=${document.fullscreenElement === wrapperRef.current} element=${document.fullscreenElement?.tagName ?? "none"}`,
        "info",
      )

      if (document.fullscreenElement === wrapperRef.current) {
        return
      }

      addLogEvent("PLAY", "Fullscreen exited; disconnecting session.", "warn")
      handleDisconnect()
      setStatus("NOT_STARTED")
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [addLogEvent, handleDisconnect])

  useEffect(() => {
    addLogEvent("PLAY", `Status changed to ${status}.`, "info")
  }, [addLogEvent, status])

  useEffect(() => {
      addLogEvent(
        "PLAY",
        `Client environment: userAgent="${navigator.userAgent}", platform="${navigator.platform}", maxTouchPoints=${navigator.maxTouchPoints}, standalone=${Boolean((navigator as Navigator & { standalone?: boolean }).standalone)}, fullscreen=${Boolean(document.fullscreenEnabled)}, visualViewport=${Boolean(window.visualViewport)}, gamepads=${
          typeof navigator.getGamepads === "function"
        }.`,
      "info",
    )
  }, [addLogEvent])

  useEffect(() => {
    if (status !== "LOADING") {
      return
    }

    const container = wrapperRef.current
    if (!container) {
      void handleErrorMessage(
        "The play surface is not ready yet. Please try again.",
      )
      return
    }

    if (!token) {
      void handleErrorMessage(
        "You need to sign in before starting a game session.",
      )
      return
    }

    const abortController = new AbortController()
    let cancelled = false

    const startLoadingSession = async () => {
      try {
        addLogEvent(
          "PLAY",
          `Waiting for fullscreen before session request. fullscreenElement=${document.fullscreenElement?.tagName ?? "none"}`,
          "info",
        )
        await waitForFullscreenElement(container)

        if (cancelled) {
          addLogEvent("PLAY", "Session request cancelled before fetch.", "warn")
          return
        }

        if (document.fullscreenElement !== container) {
          addLogEvent(
            "PLAY",
            "Fullscreen was not active after wait; returning to idle.",
            "warn",
          )
          setStatus("NOT_STARTED")
          return
        }

        const viewport = await getFullscreenViewportSize(container)
        addLogEvent(
          "PLAY",
          `Requesting session for game=${game.id} viewport=${viewport.width}x${viewport.height}.`,
          "info",
        )

        const response = await fetch(getBackendPath("/play/session"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            game_id: game.id,
            width: 640,
            height: 480,
            // width: viewport.width,
            // height: viewport.height,
          }),
          signal: abortController.signal,
        })
        const payload = await response.json().catch(() => null)
        addLogEvent(
          "PLAY",
          `Session response status=${response.status} ok=${response.ok}.`,
          response.ok ? "info" : "warn",
        )

        if (!response.ok) {
          throw new Error(getSessionErrorMessage(payload))
        }

        if (cancelled) {
          addLogEvent(
            "PLAY",
            "Session response ignored after cancellation.",
            "warn",
          )
          return
        }

        if (document.fullscreenElement !== container) {
          addLogEvent(
            "PLAY",
            "Fullscreen exited before session details were applied.",
            "warn",
          )
          setStatus("NOT_STARTED")
          return
        }

        addLogEvent("PLAY", `Play session response: ${JSON.stringify(payload)}`)

        if (isSessionPayload(payload)) {
          addLogEvent(
            "PLAY",
            `Session details received. ip=${payload.ip} tlsFingerprintLength=${payload.tls_fingerprint.length}.`,
            "info",
          )
          setWebtransportIP(payload.ip)
          setTlsFingerprint(payload.tls_fingerprint)
        } else {
          addLogEvent(
            "PLAY",
            "Session payload did not match expected shape.",
            "warn",
          )
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) {
          addLogEvent("PLAY", "Session request aborted.", "warn")
          return
        }

        addLogEvent(
          "PLAY",
          `Session startup error: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        )
        await handleErrorMessage(
          error instanceof Error ? error.message : SESSION_ERROR_MESSAGE,
        )
      }
    }

    void startLoadingSession()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [addLogEvent, game.id, status, token])

  useEffect(() => {
    ;(globalThis as any).dumpLogs = () => dumpLogs(logs)
  }, [logs])

  const handleStart = async () => {
    addLogEvent("PLAY", `Start requested while status=${status}.`, "info")

    if (status === "STREAMING" || status === "LOADING") {
      addLogEvent(
        "PLAY",
        "Start ignored because a session is already active.",
        "warn",
      )
      return
    }

    if (!token) {
      addLogEvent(
        "PLAY",
        "Start blocked because no auth token is available.",
        "warn",
      )
      await handleErrorMessage(
        "You need to sign in before starting a game session.",
      )
      return
    }

    const container = wrapperRef.current
    if (!container) {
      addLogEvent("PLAY", "Start blocked because wrapperRef is empty.", "error")
      await handleErrorMessage(
        "The play surface is not ready yet. Please try again.",
      )
      return
    }

    prepareAudioPlayback()
    addLogEvent("PLAY", "Audio playback prepared from user gesture.", "info")
    await handleErrorMessage(null)

    flushSync(() => {
      setWebtransportIP(null)
      setTlsFingerprint(null)
      setStatus("LOADING")
    })
    addLogEvent("PLAY", "State set to LOADING; requesting fullscreen.", "info")

    try {
      await container.requestFullscreen()
      addLogEvent("PLAY", "requestFullscreen resolved.", "info")
    } catch (error) {
      addLogEvent(
        "PLAY",
        `requestFullscreen failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      )
      await handleErrorMessage(
        error instanceof Error ? error.message : SESSION_ERROR_MESSAGE,
      )
    }
  }

  async function handleErrorMessage(message: string | null) {
    addLogEvent(
      "PLAY",
      message ? `Error message set: ${message}` : "Error message cleared.",
      message ? "warn" : "info",
    )
    setErrorMessage(message)
    if (message) {
      setStatus("ERROR")
      await exitFullscreen()
    }
  }

  const isStarting = status === "LOADING" || status === "STREAMING"
  const hasSessionDetails = Boolean(webtransportIP && tlsFingerprint)

  return (
    <div className='flex flex-1 bg-background' ref={wrapperRef}>
      {status === "LOADING" && !hasSessionDetails ? <LoadingScreen /> : null}

      {status === "STREAMING" || (status === "LOADING" && hasSessionDetails) ? (
        <Streaming
          handleConnecting={handleConnecting}
          webtransportIP={webtransportIP}
          tlsFingerprint={tlsFingerprint}
          status={status}
          setStatus={setStatus}
          setErrorMessage={handleErrorMessage}
          handleAudioStreams={handleAudioStreams}
        />
      ) : null}

      {status === "NOT_STARTED" || status === "ERROR" ? (
        <LandingForm
          game={game}
          errorMessage={errorMessage}
          isStarting={isStarting}
          onStart={handleStart}
        />
      ) : null}
    </div>
  )
}

async function getFullscreenViewportSize(target: Element) {
  await waitForFullscreenElement(target)

  // Wait two frames so the browser has applied fullscreen layout metrics.
  await waitForAnimationFrame()
  await waitForAnimationFrame()

  const viewport = window.visualViewport

  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  }
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function waitForFullscreenElement(target: Element) {
  if (document.fullscreenElement === target) {
    return
  }

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      resolve()
    }, 1000)

    const onChange = () => {
      if (document.fullscreenElement !== target) {
        return
      }

      cleanup()
      resolve()
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      document.removeEventListener("fullscreenchange", onChange)
    }

    document.addEventListener("fullscreenchange", onChange)
  })
}

export default function WrappedClient(props: Readonly<Props>) {
  return (
    <LogsProvider>
      <Client {...props} />
    </LogsProvider>
  )
}

async function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen()
  }
}

function getSessionErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error
  }

  return SESSION_ERROR_MESSAGE
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function isSessionPayload(
  payload: unknown,
): payload is { ip: string; tls_fingerprint: string } {
  return (
    payload !== null &&
    typeof payload === "object" &&
    "ip" in payload &&
    typeof payload.ip === "string" &&
    "tls_fingerprint" in payload &&
    typeof payload.tls_fingerprint === "string"
  )
}
