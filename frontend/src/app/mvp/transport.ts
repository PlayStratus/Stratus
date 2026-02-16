import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { useLogs } from "./logs"
import { StatusType } from "./page"

const WEBTRANSPORT_URL = "https://localhost:4433/"

export function useTransport(setStatus: Dispatch<SetStateAction<StatusType>>) {
  const { addLogEvent } = useLogs()
  const [transport, setTransport] = useState<WebTransport | null>(null)
  const transportRef = useRef<WebTransport | null>(null)
  const isMountedRef = useRef(true)

  const handleConnecting = useCallback(async () => {
    if (transportRef.current) {
      return transportRef.current
    }

    let newTransport: WebTransport | null = null

    try {
      newTransport = new WebTransport(WEBTRANSPORT_URL)
      addLogEvent("WebTransport instance created.")
    } catch (error) {
      addLogEvent(
        `Connection Object Error: ${(error as Error).message}`,
        "error",
      )
      return
    }

    try {
      await newTransport?.ready
      addLogEvent("Connection ready.")
    } catch (error) {
      addLogEvent(`Connection failed: ${(error as Error).message}`, "error")
      setStatus("error")
      return
    }

    newTransport.closed.then(
      () => {
        if (!isMountedRef.current) return
        addLogEvent("Connection closed normally.")
        setStatus("disconnected")
        transportRef.current = null
        setTransport(null)
      },
      (error) => {
        if (!isMountedRef.current) return
        addLogEvent(
          `Connection closed with error: ${(error as Error).message}`,
          "error",
        )
        setStatus("error")
        transportRef.current = null
        setTransport(null)
      },
    )

    transportRef.current = newTransport
    setTransport(newTransport)
    setStatus("connected")

    return newTransport
  }, [addLogEvent])

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

  useEffect(() => {
    transportRef.current = transport

    return () => {
      if (transport) {
        transport.close()
      }
    }
  }, [transport])

  return { handleConnecting }
}
