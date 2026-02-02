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

  function ensureVideoDecoder(description: Uint8Array) {
    // If we already have a decoder, optionally reconfigure if description changed.
    // (Simplest: only configure once; recreate on stream restart if needed.)
    if (!videoDecoderRef.current) {
      if (typeof VideoDecoder === "undefined") {
        addToEventLog("VideoDecoder API not available in this browser", "error")
        return null
      }

      const canvas = canvasRef.current
      if (!canvas) {
        addToEventLog("Canvas not ready for AVC rendering", "error")
        return null
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        addToEventLog("Could not get 2D context for canvas", "error")
        return null
      }

      const decoder = new VideoDecoder({
        output: (frame) => {
          canvas.width = frame.codedWidth
          canvas.height = frame.codedHeight
          try {
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
        error: (error) =>
          addToEventLog(`VideoDecoder error: ${error}`, "error"),
      })

      videoDecoderRef.current = decoder
      addToEventLog("VideoDecoder created (not yet configured)")
    }

    // Configure only when we have description (avcC)
    if (description && videoDecoderRef.current.state === "unconfigured") {
      videoDecoderRef.current.configure({
        codec: "avc1.42C01E",
        description,
        optimizeForLatency: true,
      })
      addToEventLog(
        `VideoDecoder configured with avcC (${description.byteLength} bytes)`,
      )
    }

    return videoDecoderRef.current
  }

  async function readFromIncomingStream(
    stream: ReadableStream<Uint8Array>,
    number: number,
  ) {
    const reader = stream.getReader()
    let buffer = new Uint8Array(0)

    // Decoder state
    let decoder: VideoDecoder | null = null
    let haveConfig = false
    let waitingForKeyAfterConfig = true

    // Use a running timestamp. WebCodecs expects microseconds.
    const frameDurationUs = Math.round(1_000_000 / 30) // or derive from sender
    let ts = 0

    function readU32BE(b: Uint8Array, off: number) {
      // >>> 0 to force unsigned
      return (
        ((b[off] << 24) |
          (b[off + 1] << 16) |
          (b[off + 2] << 8) |
          b[off + 3]) >>>
        0
      )
    }

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          addToEventLog("Stream #" + number + " closed")
          return
        }
        if (!value || value.length === 0) continue

        // append to buffer
        const tmp = new Uint8Array(buffer.length + value.length)
        tmp.set(buffer, 0)
        tmp.set(value, buffer.length)
        buffer = tmp

        // parse messages
        while (buffer.length >= 5) {
          const msgType = buffer[0]
          const payloadLen = readU32BE(buffer, 1)

          if (buffer.length < 5 + payloadLen) break

          const payload = buffer.subarray(5, 5 + payloadLen)
          buffer = buffer.subarray(5 + payloadLen)

          if (msgType === 0x00) {
            // CONFIG (avcC)
            const description = payload // already a Uint8Array view
            decoder = ensureVideoDecoder(description)
            if (!decoder) {
              addToEventLog("No decoder; dropping config", "error")
              continue
            }

            haveConfig = true
            waitingForKeyAfterConfig = true

            addToEventLog(
              `Received config (avcC) ${description.byteLength} bytes on stream #${number}`,
            )
            continue
          }

          if (msgType === 0x01) {
            if (!haveConfig) {
              addToEventLog("Received frame before config; dropping", "error")
              continue
            }
            if (!decoder || decoder.state === "unconfigured") {
              addToEventLog(
                "Decoder not configured yet; dropping frame",
                "error",
              )
              continue
            }

            if (payloadLen < 1) continue
            const isKey = payload[0] === 1
            const frameData = payload.subarray(1)

            // Enforce keyframe requirement after configure/flush/restart
            if (waitingForKeyAfterConfig) {
              if (!isKey) {
                // drop until first IDR
                continue
              }
              waitingForKeyAfterConfig = false
            }

            const chunk = new EncodedVideoChunk({
              type: isKey ? "key" : "delta",
              timestamp: ts,
              data: frameData,
            })
            ts += frameDurationUs

            decoder.decode(chunk)
            continue
          }

          // Unknown msg type
          addToEventLog(`Unknown message type ${msgType}; dropping`, "error")
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      addToEventLog(
        "Error while reading from stream #" + number + ": " + errorMessage,
        "error",
      )
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
