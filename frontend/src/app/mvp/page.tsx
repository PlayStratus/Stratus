"use client"

import { useEffect, useState, useRef } from "react"

import Connecting from "./Connecting"
import ControlPanel from "./ControlPanel"
import FullScreenButton from "./FullScreenButton"

export type LogType = {
  message: string
  severity: "info" | "error"
}

const WEBTRANSPORT_URL = "https://localhost:4433/"

export default function MVPPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogType[]>([])
  const [transport, setTransport] = useState<WebTransport | null>(null)
  const [datagramWriter, setDatagramWriter] =
    useState<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const streamNumberRef = useRef<number>(1)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoDecoderRef = useRef<VideoDecoder | null>(null)

  function addToEventLog(message: string, severity: "info" | "error" = "info") {
    setLogs((prevLog) => [...prevLog, { message, severity }])
  }

  const handleConnecting = async () => {
    let transport: WebTransport | null = null

    try {
      transport = new WebTransport(WEBTRANSPORT_URL)
      addToEventLog("WebTransport instance created.")
    } catch (error) {
      addToEventLog(
        `Connection Object Error: ${(error as Error).message}`,
        "error",
      )
      return
    }

    try {
      await transport?.ready
      addToEventLog("Connection ready.")
    } catch (error) {
      addToEventLog(`Connection failed: ${(error as Error).message}`, "error")
      return
    }

    transport.closed.then(
      () => {
        addToEventLog("Connection closed normally.")
      },
      (error) => {
        addToEventLog(
          `Connection closed with error: ${(error as Error).message}`,
          "error",
        )
      },
    )
    setTransport(transport)

    try {
      const datagramWriter = transport.datagrams.writable.getWriter()
      addToEventLog("Datagram writer obtained.")
      setDatagramWriter(datagramWriter)
    } catch (error) {
      addToEventLog(
        `Datagram writer error: ${(error as Error).message}`,
        "error",
      )
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
        "error",
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

  function ensureVideoDecoder() {
    if (!videoDecoderRef.current) {
      if (typeof VideoDecoder === "undefined") {
        addToEventLog("VideoDecoder API not available in this browser", "error")
        return null
      }

      const canvas = canvasRef.current
      if (!canvas) {
        addToEventLog("Canvas not ready for VP9 rendering", "error")
        return null
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        addToEventLog("Could not get 2D context for canvas", "error")
        return null
      }

      const decoder = new VideoDecoder({
        output: (frame) => {
          // Resize canvas to the incoming frame and draw it.
          canvas.width = frame.codedWidth
          canvas.height = frame.codedHeight
          try {
            // Some TS lib versions don't yet have transferToImageBitmap
            const anyFrame: any = frame
            if (typeof anyFrame.transferToImageBitmap === "function") {
              const bitmap = anyFrame.transferToImageBitmap()
              ctx.drawImage(bitmap, 0, 0)
            } else {
              ctx.drawImage(anyFrame, 0, 0)
            }
          } finally {
            frame.close()
          }
        },
        error: (error) => {
          addToEventLog(`VideoDecoder error: ${error}`, "error")
        },
      })

      decoder.configure({ codec: "vp09.00.10.08" })

      videoDecoderRef.current = decoder
      addToEventLog("VideoDecoder for VP9 (vp09.00.10.08) initialized")
    }

    return videoDecoderRef.current
  }

  async function readFromIncomingStream(
    stream: ReadableStream<Uint8Array>,
    number: number,
  ) {
    const reader = stream.getReader()
    let buffer = new Uint8Array(0)

    const decoder = ensureVideoDecoder()
    if (!decoder) {
      addToEventLog("Cannot read VP9 stream without decoder", "error")
      return
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          addToEventLog("Stream #" + number + " closed")
          return
        }

        if (!value) continue

        // Concatenate the new chunk to our buffer.
        const tmp = new Uint8Array(buffer.length + value.length)
        tmp.set(buffer, 0)
        tmp.set(value, buffer.length)
        buffer = tmp

        // Process as many length-prefixed VP9 frames as are fully available.
        while (buffer.length >= 4) {
          const frameLength =
            (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]

          if (buffer.length < 4 + frameLength) {
            // Wait for more data.
            break
          }

          const frameData = buffer.subarray(4, 4 + frameLength)
          buffer = buffer.subarray(4 + frameLength)

          addToEventLog(
            `Received VP9 frame of ${frameData.byteLength} bytes on stream #${number}`,
          )

          const chunk = new EncodedVideoChunk({
            type: "key",
            timestamp: 0,
            data: frameData,
          })
          decoder.decode(chunk)
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      addToEventLog(
        "Error while reading from stream #" + number + ": " + errorMessage,
        "error",
      )
      addToEventLog("    " + errorMessage)
    }
  }

  useEffect(() => {
    handleConnecting()
  }, [])

  return isConnected && transport && datagramWriter ? (
    <div
      ref={containerRef}
      className='relative w-screen h-screen bg-black overflow-hidden'
    >
      <canvas
        ref={canvasRef}
        className='w-full h-full object-contain bg-black'
      />

      <ControlPanel
        transport={transport}
        datagramWriter={datagramWriter}
        logs={logs}
        addLogEvent={addToEventLog}
        containerRef={containerRef}
      />

      <FullScreenButton containerRef={containerRef} />
    </div>
  ) : (
    <Connecting connectingLog={logs} />
  )
}
