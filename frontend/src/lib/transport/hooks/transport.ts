import { useCallback, useEffect, useRef } from "react"

import { useLogs } from "./logs"

export function useTransport(handleError: (errorMessage: string) => void) {
  const { addLogEvent } = useLogs()
  const transportRef = useRef<WebTransport | null>(null)
  const isMountedRef = useRef(true)

  const handleConnecting = useCallback(
    async (url: string, tlsFingerprint: string) => {
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
        handleError(errorMessage)
        return
      }

      const trimmedHash = tlsFingerprint.trim()
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
          handleError(errorMessage)
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
        handleError(errorMessage)
        return
      }

      try {
        await newTransport?.ready
        addLogEvent("TRANSPORT", "Connection ready.", "info")
      } catch (error) {
        const errorMessage = `Connection failed: ${(error as Error).message}`
        addLogEvent("TRANSPORT", errorMessage, "error")
        handleError(errorMessage)
        return
      }

      newTransport.closed.then(
        () => {
          if (!isMountedRef.current) return
          const errorMessage = "Connection closed."
          addLogEvent("TRANSPORT", errorMessage, "info")
          handleError(errorMessage)
          transportRef.current = null
        },
        (error) => {
          if (!isMountedRef.current) return
          const errorMessage = `Connection closed with error: ${(error as Error).message}`
          addLogEvent("TRANSPORT", errorMessage, "error")
          handleError(errorMessage)
          transportRef.current = null
        },
      )

      transportRef.current = newTransport

      return newTransport
    },
    [addLogEvent, handleError],
  )

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

  const handleDisconnect = useCallback(() => {
    if (transportRef.current) {
      transportRef.current.close()
      transportRef.current = null
    }
  }, [])

  return { handleConnecting, handleDisconnect }
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

  // stratusd currently serves WebTransport on 4433, so if the backend sends
  // only a hostname/IP we need to supply the transport port here.
  if (!normalizedUrl.port) {
    normalizedUrl.port = "4433"
  }

  if (!normalizedUrl.pathname) {
    normalizedUrl.pathname = "/"
  }

  return normalizedUrl.toString()
}
