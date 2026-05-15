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

      if (typeof WebTransport === "undefined") {
        handleError(getWebTransportUnavailableMessage())
        return
      }

      let newTransport: WebTransport | null = null
      let transportUrl: string

      try {
        transportUrl = normalizeWebTransportUrl(url)
      } catch (error) {
        const errorMessage = `Invalid URL: ${(error as Error).message}`
        handleError(errorMessage)
        return
      }

      const trimmedHash = normalizeCertificateHashInput(tlsFingerprint)
      let serverCertificateHashes: WebTransportHash[] | undefined

      if (trimmedHash) {
        try {
          const hashValue = Uint8Array.from(atob(trimmedHash), (char) => {
            return char.codePointAt(0) ?? 0
          })

          if (hashValue.byteLength !== 32) {
            throw new Error("The SHA-256 fingerprint must decode to 32 bytes.")
          }

          serverCertificateHashes = [
            {
              algorithm: "sha-256",
              value: hashValue,
            },
          ]
        } catch (error) {
          const errorMessage = `Invalid TLS hash: ${(error as Error).message}`
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
        handleError(errorMessage)
        return
      }

      try {
        await newTransport.ready
        addLogEvent("TRANSPORT", "Connection ready.", "info")
      } catch (error) {
        newTransport.close()
        const errorMessage = getConnectionFailureMessage(error)
        handleError(errorMessage)
        return
      }

      newTransport.closed.then(
        () => {
          if (!isMountedRef.current) return
          const errorMessage = "Connection closed."
          handleError(errorMessage)
          transportRef.current = null
        },
        (error) => {
          if (!isMountedRef.current) return
          const errorMessage = `Connection closed with error: ${getErrorMessage(error)}`
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

      addLogEvent(
        "TRANSPORT",
        "Component unmounted, closing active transport connection.",
        "log",
      )
    }
  }, [addLogEvent])

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

  if (!normalizedUrl.pathname) {
    normalizedUrl.pathname = "/"
  }

  return normalizedUrl.toString()
}

function getConnectionFailureMessage(error: unknown) {
  const message = getErrorMessage(error)

  return `Connection failed: ${message}}`
}

function normalizeCertificateHashInput(input: string) {
  const trimmedInput = input.trim()
  if (!trimmedInput) {
    return ""
  }

  const compactInput = trimmedInput.replace(/\s+/g, "")
  if (/^[A-Za-z0-9+/]{43}=$/.test(compactInput)) {
    return compactInput
  }

  const match = /[A-Za-z0-9+/]{43}=/.exec(trimmedInput)
  return match ? match[0] : trimmedInput
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || error.name
  }

  return String(error)
}

function getWebTransportUnavailableMessage() {
  if (isIOSUserAgent()) {
    return `WebTransport is not available in this browser.`
  }

  return "WebTransport is not available in this browser. Use a browser with WebTransport support."
}

function isIOSUserAgent() {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}
