import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react"

import { useLogs } from "./logs"
import { TransportMediaStream } from "../utils/transportMediaStream"

const SAMPLE_RATE = 48_000
const CHANNELS = 2

export function useAudioStream(
  setAverageAudioRenderTimeMs?: Dispatch<SetStateAction<number>>,
) {
  const { addLogEvent } = useLogs()
  const audioContextRef = useRef<AudioContext | null>(null)
  const rendererRef = useRef<AudioWorkletNode | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<TransportMediaStream | null>(null)
  const isUnmountedRef = useRef(false)

  const getRenderer = useCallback(async () => {
    if (rendererRef.current) {
      return rendererRef.current
    }

    if (typeof AudioContext === "undefined") {
      addLogEvent("AUDIO", "AudioContext API not available", "error")
      return null
    }

    if (!("audioWorklet" in AudioContext.prototype)) {
      addLogEvent("AUDIO", "AudioWorklet API not available", "error")
      return null
    }

    if (typeof AudioDecoder === "undefined") {
      addLogEvent(
        "AUDIO",
        "AudioDecoder API not available in this browser",
        "error",
      )
      return null
    }

    const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })

    try {
      await loadAudioWorkletModule(audioCtx)
    } catch (error) {
      await audioCtx.close().catch(() => undefined)
      throw error
    }

    const renderer = new AudioWorkletNode(audioCtx, "stratus-audio-renderer", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [CHANNELS],
    })

    renderer.connect(audioCtx.destination)

    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => undefined)
    }

    audioContextRef.current = audioCtx
    rendererRef.current = renderer
    addLogEvent("AUDIO", "Audio worklet started")

    return renderer
  }, [addLogEvent])

  const getWorker = useCallback(
    (renderer: AudioWorkletNode) => {
      if (workerRef.current) {
        return workerRef.current
      }

      const worker = new Worker(
        new URL("./audioStream.worker.ts", import.meta.url),
        { type: "module" },
      )

      worker.onmessage = (event: MessageEvent<any>) => {
        const message = event.data

        if (message.type === "log") {
          addLogEvent("AUDIO", message.message, message.severity)
        } else if (message.type === "metrics") {
          setAverageAudioRenderTimeMs?.(message.averageRenderTimeMs)
        } else if (message.type === "error") {
          addLogEvent("AUDIO", message.message, "error")
        }
      }

      worker.onerror = (event) => {
        if (!isUnmountedRef.current) {
          addLogEvent("AUDIO", event.message || "Audio worker error", "error")
        }
      }

      worker.postMessage({ type: "init", port: renderer.port }, [renderer.port])
      workerRef.current = worker
      addLogEvent("AUDIO", "Audio decoder worker started")

      return worker
    },
    [addLogEvent, setAverageAudioRenderTimeMs],
  )

  const getStream = useCallback(
    (worker: Worker) => {
      if (streamRef.current) {
        return streamRef.current
      }

      const stream = new TransportMediaStream({
        worker,
        label: "Audio",
        onOpen: () => addLogEvent("AUDIO", "Audio stream opened"),
        onClose: () => addLogEvent("AUDIO", "Audio stream closed"),
        onError: (message) => addLogEvent("AUDIO", message, "error"),
        isClosed: () => isUnmountedRef.current,
      })

      streamRef.current = stream
      return stream
    },
    [addLogEvent],
  )

  const handleAudioStreams = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      initialChunk: Uint8Array,
    ) => {
      let renderer: AudioWorkletNode | null = null

      try {
        renderer = await getRenderer()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        addLogEvent(
          "AUDIO",
          `Audio worklet startup error: ${errorMessage}`,
          "error",
        )
      }

      const worker = renderer ? getWorker(renderer) : null
      if (!renderer || !worker) {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
        return
      }

      await getStream(worker).start(reader, initialChunk)
    },
    [getRenderer, getStream, getWorker],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      streamRef.current?.close()
      streamRef.current = null
      workerRef.current?.postMessage({ type: "close" })
      workerRef.current = null
      rendererRef.current?.disconnect()
      rendererRef.current = null
      void audioContextRef.current?.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [])

  return { handleAudioStreams }
}

async function loadAudioWorkletModule(audioCtx: AudioContext) {
  await audioCtx.audioWorklet.addModule("/audioStream.worklet.js")
}
