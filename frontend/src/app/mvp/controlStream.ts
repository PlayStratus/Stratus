import { useCallback, useEffect, useRef, useState } from "react"

import { useLogs } from "./logs"

const videoCodecsToTest = [
  "vp8",
  "vp09.00.10.08",
  "avc1.42E01E",
  "avc1.64001F",
  "hev1.1.6.L93.B0",
  "av01.0.05M.08",
]

const audioCodecsToTest = [
  "opus",
  "mp4a.40.2",
  "mp4a.40.5",
  "mp4a.67",
  "flac",
  "vorbis",
]

interface CodecSupport {
  videoDecoder: boolean
  audioDecoder: boolean
  supportedVideoCodecs: string[]
  supportedAudioCodecs: string[]
}

function isReleasedWriterError(error: unknown) {
  const message = (error as Error)?.message ?? ""
  return (
    message.toLowerCase().includes("writer") &&
    message.toLowerCase().includes("released")
  )
}

function isAlreadyClosingWriterError(error: unknown) {
  const message = ((error as Error)?.message ?? "").toLowerCase()
  return (
    message.includes("already been requested to be closed") ||
    message.includes("cannot close a writable stream that is closed") ||
    message.includes("cannot close a closed writable stream")
  )
}

export function useControlStream(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
) {
  const { addLogEvent } = useLogs()

  const [controlStreamWriter, setControlStreamWriter] =
    useState<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const controlStreamWriterRef =
    useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const didCheckCodecSupportRef = useRef(false)

  const closeWriter = useCallback(
    async (writer: WritableStreamDefaultWriter<Uint8Array> | null) => {
      if (!writer) return
      try {
        await writer.close()
      } catch (error) {
        if (
          isReleasedWriterError(error) ||
          isAlreadyClosingWriterError(error)
        ) {
          return
        }
        addLogEvent(
          `Control writer close warning: ${(error as Error).message}`,
          "error",
        )
      } finally {
        writer.releaseLock()
      }
    },
    [addLogEvent],
  )

  const handleControlStream = useCallback(
    async (transport: WebTransport) => {
      try {
        await closeWriter(controlStreamWriterRef.current)
        const stream = await transport.createBidirectionalStream()
        const writer = stream.writable.getWriter()
        addLogEvent("Control bidirectional stream created.")
        controlStreamWriterRef.current = writer
        setControlStreamWriter(writer)
      } catch (error) {
        addLogEvent(
          `Control Stream Error: ${(error as Error).message}`,
          "error",
        )
        return
      }
    },
    [addLogEvent, closeWriter],
  )

  useEffect(() => {
    if (!controlStreamWriter) {
      return
    }

    if (!didCheckCodecSupportRef.current) {
      didCheckCodecSupportRef.current = true
      void checkCodecSupport()
    }

    const element = canvasRef.current
    if (!element) return

    const encoder = new TextEncoder()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let disposed = false
    let lastSentWidth = -1
    let lastSentHeight = -1
    let didLogWriteFailure = false

    const stopSending = async () => {
      if (disposed) return
      disposed = true
      resizeObserver.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      const writerToClose = controlStreamWriterRef.current
      controlStreamWriterRef.current = null
      setControlStreamWriter(null)
      await closeWriter(writerToClose)
    }

    const sendResize = async () => {
      timeoutId = null
      if (disposed) return

      const currentWidth = element.clientWidth
      const currentHeight = element.clientHeight

      if (currentWidth === lastSentWidth && currentHeight === lastSentHeight) {
        return
      }

      const data = encoder.encode(
        JSON.stringify({
          type: "resize",
          width: currentWidth,
          height: currentHeight,
        }),
      )

      const writer = controlStreamWriterRef.current

      if (writer) {
        try {
          await writer.ready
          await writer.write(data)
          lastSentWidth = currentWidth
          lastSentHeight = currentHeight
        } catch (error) {
          if (isReleasedWriterError(error)) {
            await stopSending()
            return
          }

          const message = (error as Error).message
          if (!didLogWriteFailure) {
            didLogWriteFailure = true
            addLogEvent(`Error sending resize data: ${message}`, "error")
          }
          await stopSending()
        }
      }
    }

    const queueResize = () => {
      if (disposed || timeoutId) return
      timeoutId = setTimeout(() => {
        void sendResize()
      }, 100)
    }

    const resizeObserver = new ResizeObserver(queueResize)

    resizeObserver.observe(element)
    void sendResize()

    return () => {
      disposed = true
      resizeObserver.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [addLogEvent, canvasRef, closeWriter, controlStreamWriter])

  useEffect(() => {
    controlStreamWriterRef.current = controlStreamWriter
  }, [controlStreamWriter])

  useEffect(() => {
    return () => {
      void closeWriter(controlStreamWriterRef.current)
      controlStreamWriterRef.current = null
    }
  }, [closeWriter])

  return { handleControlStream }
}

async function checkCodecSupport() {
  const support: CodecSupport = {
    videoDecoder: typeof VideoDecoder !== "undefined",
    audioDecoder: typeof AudioDecoder !== "undefined",
    supportedVideoCodecs: [],
    supportedAudioCodecs: [],
  }

  if (support.videoDecoder && VideoDecoder.isConfigSupported) {
    for (const codec of videoCodecsToTest) {
      try {
        const config = {
          codec,
          codedWidth: 1920,
          codedHeight: 1080,
        }
        const result = await VideoDecoder.isConfigSupported(config)
        if (result.supported) {
          support.supportedVideoCodecs.push(codec)
        }
      } catch (e) {
        console.error(`Error checking video codec ${codec}:`, e)
      }
    }
  }

  if (support.audioDecoder && AudioDecoder.isConfigSupported) {
    for (const codec of audioCodecsToTest) {
      try {
        const config: AudioDecoderConfig = {
          codec,
          description: new TextEncoder().encode(`Test ${codec}`),
          sampleRate: 48000,
          numberOfChannels: 2,
        }
        const result = await AudioDecoder.isConfigSupported(config)
        if (result.supported) {
          support.supportedAudioCodecs.push(codec)
        }
      } catch (e) {
        console.error(`Error checking audio codec ${codec}:`, e)
      }
    }
  }

  console.log("VideoDecoder available:", support.videoDecoder)
  console.log("AudioDecoder available:", support.audioDecoder)
  console.log("Supported video codecs:", support.supportedVideoCodecs)
  console.log("Supported audio codecs:", support.supportedAudioCodecs)
}
