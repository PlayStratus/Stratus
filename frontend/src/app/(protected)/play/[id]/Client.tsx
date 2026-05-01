"use client"

import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { getBackendPath } from "@/lib/backend/getBackendPath"

import { useAuth } from "@/components/auth/AuthProvider"

import { dumpLogs, LogsProvider, useLogs } from "@/lib/transport/hooks/logs"
import { useTransport } from "@/lib/transport/hooks/transport"
import { StatusType } from "@/lib/transport/types"

import LandingForm from "./LandingForm"
import Streaming, { LoadingScreen } from "./Streaming"

const SESSION_ERROR_MESSAGE = "The game session could not be started."

type Props = {
  id: string
  title: string
}

function Client({ id, title }: Readonly<Props>) {
  const { token } = useAuth()

  const wrapperRef = useRef<HTMLDivElement>(null)

  const [webtransportIP, setWebtransportIP] = useState<string | null>(null)
  const [tlsFingerprint, setTlsFingerprint] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusType>("NOT_STARTED")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { logs } = useLogs()
  const { handleConnecting, handleDisconnect } =
    useTransport(handleErrorMessage)

  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement === wrapperRef.current) {
        return
      }

      handleDisconnect()
      setStatus("NOT_STARTED")
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

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
        await waitForFullscreenElement(container)

        if (cancelled) {
          return
        }

        if (document.fullscreenElement !== container) {
          setStatus("NOT_STARTED")
          return
        }

        const viewport = await getFullscreenViewportSize(container)

        const response = await fetch(getBackendPath("/play/session"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            game_id: id,
            width: 640,
            height: 480,
            // width: viewport.width,
            // height: viewport.height,
          }),
          signal: abortController.signal,
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(getSessionErrorMessage(payload))
        }

        if (cancelled) {
          return
        }

        if (document.fullscreenElement !== container) {
          setStatus("NOT_STARTED")
          return
        }

        console.log("Play session response:", payload)

        if (isSessionPayload(payload)) {
          setWebtransportIP(payload.ip)
          setTlsFingerprint(payload.tls_fingerprint)
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) {
          return
        }

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
  }, [id, status, token])

  useEffect(() => {
    ;(globalThis as any).dumpLogs = () => dumpLogs(logs)
  }, [logs])

  const handleStart = async () => {
    if (status === "STREAMING" || status === "LOADING") {
      return
    }

    if (!token) {
      await handleErrorMessage(
        "You need to sign in before starting a game session.",
      )
      return
    }

    const container = wrapperRef.current
    if (!container) {
      await handleErrorMessage(
        "The play surface is not ready yet. Please try again.",
      )
      return
    }

    await handleErrorMessage(null)

    flushSync(() => {
      setWebtransportIP(null)
      setTlsFingerprint(null)
      setStatus("LOADING")
    })

    try {
      await container.requestFullscreen()
    } catch (error) {
      await handleErrorMessage(
        error instanceof Error ? error.message : SESSION_ERROR_MESSAGE,
      )
    }
  }

  async function handleErrorMessage(message: string | null) {
    setErrorMessage(message)
    if (message) {
      setStatus("ERROR")
      await exitFullscreen()
    }
  }

  const isStarting = status === "LOADING" || status === "STREAMING"
  const hasSessionDetails = Boolean(webtransportIP && tlsFingerprint)

  return (
    <div className='flex flex-1' ref={wrapperRef}>
      {status === "LOADING" && !hasSessionDetails ? <LoadingScreen /> : null}

      {status === "STREAMING" || (status === "LOADING" && hasSessionDetails) ? (
        <Streaming
          handleConnecting={handleConnecting}
          webtransportIP={webtransportIP}
          tlsFingerprint={tlsFingerprint}
          status={status}
          setStatus={setStatus}
          setErrorMessage={handleErrorMessage}
        />
      ) : null}

      {status === "NOT_STARTED" || status === "ERROR" ? (
        <LandingForm
          title={title}
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
