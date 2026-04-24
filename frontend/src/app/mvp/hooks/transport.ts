import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react"

import { useLogs } from "./logs"
import { StatusType } from "../ClientPage"

export function useTransport(
  url: string,
  tlsCert: string,
  setStatus: Dispatch<SetStateAction<StatusType>>,
  handleTransportError: (errorMessage: string) => void,
) {
  const { addLogEvent } = useLogs()
  const transportRef = useRef<WebTransport | null>(null)
  const isMountedRef = useRef(true)

  const handleConnecting = useCallback(async () => {
    if (transportRef.current) {
      return transportRef.current
    }

    let newTransport: WebTransport | null = null
    let transportUrl: string

    try {
      transportUrl = normalizeWebTransportUrl(url)
    } catch (error) {
      const errorMessage = `Invalid URL: ${(error as Error).message}`
      addLogEvent("TRANSPORT", errorMessage, "error")
      setStatus("error")
      handleTransportError(errorMessage)
      return
    }

    const trimmedHash = tlsCert.trim()
    let serverCertificateHashes: WebTransportHash[] | undefined

    if (trimmedHash) {
      try {
        serverCertificateHashes = [
          {
            algorithm: "sha-256",
            value: Uint8Array.from(atob(trimmedHash), (char) => {
              return char.codePointAt(0) ?? 0
            }),
          },
        ]
      } catch (error) {
        const errorMessage = `Invalid TLS hash: ${(error as Error).message}`
        addLogEvent("TRANSPORT", errorMessage, "error")
        setStatus("error")
        handleTransportError(errorMessage)
        return
      }
    }

    try {
      newTransport = new WebTransport(transportUrl, {
        serverCertificateHashes,
      })
      addLogEvent(
        "TRANSPORT",
        `WebTransport instance created for ${transportUrl}.`,
        "info",
      )
    } catch (error) {
      const errorMessage = `Connection Object Error: ${(error as Error).message}`
      addLogEvent("TRANSPORT", errorMessage, "error")
      setStatus("error")
      handleTransportError(errorMessage)
      return
    }

    try {
      await newTransport?.ready
      addLogEvent("TRANSPORT", "Connection ready.", "info")
    } catch (error) {
      const errorMessage = `Connection failed: ${(error as Error).message}`
      addLogEvent("TRANSPORT", errorMessage, "error")
      setStatus("error")
      handleTransportError(errorMessage)
      return
    }

    newTransport.closed.then(
      () => {
        if (!isMountedRef.current) return
        const errorMessage = "Connection closed."
        addLogEvent("TRANSPORT", errorMessage, "info")
        setStatus("disconnected")
        transportRef.current = null
        handleTransportError(errorMessage)
      },
      (error) => {
        if (!isMountedRef.current) return
        const errorMessage = `Connection closed with error: ${(error as Error).message}`
        addLogEvent("TRANSPORT", errorMessage, "error")
        setStatus("error")
        transportRef.current = null
        handleTransportError(errorMessage)
      },
    )

    transportRef.current = newTransport
    setStatus("connected")

    return newTransport
  }, [addLogEvent, handleTransportError, setStatus, tlsCert, url])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      const activeTransport = transportRef.current
      transportRef.current = null
      if (activeTransport) {
        activeTransport.close()
      }
    }
  }, [])

  return { handleConnecting }
}

function normalizeWebTransportUrl(url: string) {
  const input = url.trim()

  if (!input) {
    throw new Error("A URL is required.")
  }

  const normalizedInput = input.includes("://") ? input : `https://${input}`
  const normalizedUrl = new URL(normalizedInput)

  if (normalizedUrl.protocol !== "https:") {
    throw new Error("WebTransport requires an https:// URL.")
  }

  if (!normalizedUrl.pathname) {
    normalizedUrl.pathname = "/"
  }

  return normalizedUrl.toString()
}
