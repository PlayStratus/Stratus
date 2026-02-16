import { useCallback, useEffect, useRef } from "react"

import { useLogs } from "./logs"
import { StatusType } from "./page"

export function useVideoStream(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setStatus: React.Dispatch<React.SetStateAction<StatusType>>,
) {
  const { addLogEvent } = useLogs()
  const streamNumberRef = useRef<number>(1)
  const videoDecoderRef = useRef<VideoDecoder | null>(null)
  const incomingStreamReaderRef = useRef<ReadableStreamDefaultReader<
    ReadableStream<Uint8Array>
  > | null>(null)
  const streamReadersRef = useRef<Set<ReadableStreamDefaultReader<Uint8Array>>>(
    new Set(),
  )
  const isUnmountedRef = useRef(false)

  const ensureVideoDecoder = useCallback(
    (description: Uint8Array) => {
      // If we already have a decoder, optionally reconfigure if description changed.
      // (Simplest: only configure once; recreate on stream restart if needed.)
      if (!videoDecoderRef.current) {
        if (typeof VideoDecoder === "undefined") {
          addLogEvent("VideoDecoder API not available in this browser", "error")
          return null
        }

        const canvas = canvasRef.current
        if (!canvas) {
          addLogEvent("Canvas not ready for AVC rendering", "error")
          return null
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          addLogEvent("Could not get 2D context for canvas", "error")
          return null
        }

        const decoder = new VideoDecoder({
          output: (frame) => {
            if (canvas.width !== frame.codedWidth) {
              canvas.width = frame.codedWidth
            }
            if (canvas.height !== frame.codedHeight) {
              canvas.height = frame.codedHeight
            }
            try {
              const anyFrame = frame as VideoFrame & {
                transferToImageBitmap?: () => ImageBitmap
              }
              if (typeof anyFrame.transferToImageBitmap === "function") {
                const bitmap = anyFrame.transferToImageBitmap()
                ctx.drawImage(bitmap, 0, 0)
                bitmap.close()
              } else {
                ctx.drawImage(frame, 0, 0)
              }
            } finally {
              frame.close()
            }
          },
          error: (error) =>
            addLogEvent(`VideoDecoder error: ${error}`, "error"),
        })

        videoDecoderRef.current = decoder
        addLogEvent("VideoDecoder created (not yet configured)")
      }

      // Configure only when we have description (avcC)
      if (description && videoDecoderRef.current.state === "unconfigured") {
        videoDecoderRef.current.configure({
          codec: "avc1.42C01E",
          description,
          optimizeForLatency: true,
        })
        addLogEvent(
          `VideoDecoder configured with avcC (${description.byteLength} bytes)`,
        )
      }

      return videoDecoderRef.current
    },
    [addLogEvent, canvasRef],
  )

  const readFromIncomingStream = useCallback(
    async (stream: ReadableStream<Uint8Array>, number: number) => {
      const reader = stream.getReader()
      streamReadersRef.current.add(reader)
      let buffer = new Uint8Array(0)

      // Decoder state
      let decoder: VideoDecoder | null = null
      let haveConfig = false
      let waitingForKeyAfterConfig = true

      // Use a running timestamp. WebCodecs expects microseconds.
      const frameDurationUs = Math.round(1_000_000 / 15) // or derive from sender
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

      setStatus("streaming")

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            addLogEvent("Stream #" + number + " closed")
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
                addLogEvent("No decoder; dropping config", "error")
                continue
              }

              haveConfig = true
              waitingForKeyAfterConfig = true

              addLogEvent(
                `Received config (avcC) ${description.byteLength} bytes on stream #${number}`,
              )
              continue
            }

            if (msgType === 0x01) {
              if (!haveConfig) {
                addLogEvent("Received frame before config; dropping", "error")
                continue
              }
              if (!decoder || decoder.state === "unconfigured") {
                addLogEvent(
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
            addLogEvent(`Unknown message type ${msgType}; dropping`, "error")
          }
        }
      } catch (e) {
        if (isUnmountedRef.current) return
        const errorMessage = e instanceof Error ? e.message : String(e)
        addLogEvent(
          "Error while reading from stream #" + number + ": " + errorMessage,
          "error",
        )
      } finally {
        streamReadersRef.current.delete(reader)
        reader.releaseLock()
      }
    },
    [addLogEvent, ensureVideoDecoder],
  )

  const handleVideoStreams = useCallback(
    async (transport: WebTransport) => {
      if (incomingStreamReaderRef.current) {
        return
      }

      const reader = transport.incomingUnidirectionalStreams.getReader()
      incomingStreamReaderRef.current = reader

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            incomingStreamReaderRef.current = null
            addLogEvent("Done accepting unidirectional streams!")
            return
          }
          const stream = value
          const number = streamNumberRef.current++
          addLogEvent("New incoming unidirectional stream #" + number)
          void readFromIncomingStream(stream, number)
        }
      } catch (e) {
        if (isUnmountedRef.current) return
        const errorMessage = e instanceof Error ? e.message : String(e)
        addLogEvent("Error while accepting streams: " + errorMessage, "error")
      } finally {
        incomingStreamReaderRef.current = null
        reader.releaseLock()
      }
    },
    [addLogEvent, readFromIncomingStream],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      const incomingReader = incomingStreamReaderRef.current
      if (incomingReader) {
        void incomingReader.cancel().catch(() => undefined)
      }

      streamReadersRef.current.forEach((reader) => {
        void reader.cancel().catch(() => undefined)
      })
      streamReadersRef.current.clear()

      if (videoDecoderRef.current) {
        videoDecoderRef.current.close()
      }
    }
  }, [])

  return { handleVideoStreams }
}
