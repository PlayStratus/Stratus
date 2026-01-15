"use client"

import { useEffect, useState, useRef } from "react"

import Connecting from "./Connecting"
import Play from "./Play"

const WEBTRANSPORT_URL = "https://localhost:4433/counter"

export default function FullscreenBox() {
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [transport, setTransport] = useState<WebTransport | null>(null)
  const [datagramWriter, setDatagramWriter] =
    useState<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const streamNumberRef = useRef<number>(1)

  function addToEventLog(text: string, _severity: string = "info") {
    setLogs((prevLog) => [...prevLog, text])
  }

  const handleConnecting = async () => {
    let transport: WebTransport | null = null

    try {
      transport = new WebTransport(WEBTRANSPORT_URL)
      setLogs((prevLog) => [...prevLog, "WebTransport instance created."])
    } catch (error) {
      setLogs((prevLog) => [
        ...prevLog,
        `Connection Object Error: ${(error as Error).message}`,
      ])
      return
    }

    try {
      await transport?.ready
      setLogs((prevLog) => [...prevLog, "Connection ready."])
    } catch (error) {
      setLogs((prevLog) => [
        ...prevLog,
        `Connection failed: ${(error as Error).message}`,
      ])
      return
    }

    transport.closed.then(
      () => {
        setLogs((prevLog) => [...prevLog, "Connection closed normally."])
      },
      (error) => {
        setLogs((prevLog) => [
          ...prevLog,
          `Connection closed with error: ${(error as Error).message}`,
        ])
      }
    )
    setTransport(transport)

    try {
      const datagramWriter = transport.datagrams.writable.getWriter()
      setLogs((prevLog) => [...prevLog, "Datagram writer obtained."])
      // You can send initial datagrams here if needed
      setDatagramWriter(datagramWriter)
    } catch (error) {
      setLogs((prevLog) => [
        ...prevLog,
        `Datagram writer error: ${(error as Error).message}`,
      ])
      return
    }

    readDatagrams(transport)
    acceptUnidirectionalStreams(transport)

    setIsConnected(true)
  }

  async function readDatagrams(transport: WebTransport) {
    let reader: ReadableStreamDefaultReader<Uint8Array>
    try {
      reader = transport.datagrams.readable.getReader()
      addToEventLog("Datagram reader ready.")
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      addToEventLog(
        "Receiving datagrams not supported: " + errorMessage,
        "error"
      )
      return
    }
    const decoder = new TextDecoder("utf-8")
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          addToEventLog("Done reading datagrams!")
          return
        }
        const data = decoder.decode(value)
        addToEventLog("Datagram received: " + data)
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      addToEventLog("Error while reading datagrams: " + errorMessage, "error")
    }
  }

  async function acceptUnidirectionalStreams(transport: WebTransport) {
    const reader = transport.incomingUnidirectionalStreams.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          addToEventLog("Done accepting unidirectional streams!")
          return
        }
        const stream = value
        const number = streamNumberRef.current++
        addToEventLog("New incoming unidirectional stream #" + number)
        readFromIncomingStream(stream, number)
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      addToEventLog("Error while accepting streams: " + errorMessage, "error")
    }
  }

  async function readFromIncomingStream(
    stream: ReadableStream<Uint8Array>,
    number: number
  ) {
    const decoder = new TextDecoderStream()
    const reader = stream.pipeThrough(decoder as any).getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          addToEventLog("Stream #" + number + " closed")
          return
        }
        const data = value
        addToEventLog("Received data on stream #" + number + ": " + data)
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      addToEventLog(
        "Error while reading from stream #" + number + ": " + errorMessage,
        "error"
      )
      addToEventLog("    " + errorMessage)
    }
  }

  useEffect(() => {
    handleConnecting()
  }, [])

  return isConnected && transport && datagramWriter ? (
    <Play
      transport={transport}
      datagramWriter={datagramWriter}
      logs={logs}
      setLogs={setLogs}
    />
  ) : (
    <Connecting connectingLog={logs} />
  )
}
