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
const AUDIO_RESUME_EVENTS = ["pointerdown", "keydown", "touchstart"] as const

type AudioLogEvent = (
  component: "AUDIO",
  message: string,
  severity?: "info" | "log" | "warn" | "error",
) => void

export function useAudioStream(
  setAverageAudioRenderTimeMs?: Dispatch<SetStateAction<number>>,
) {
  const { addLogEvent } = useLogs()
  const audioContextRef = useRef<AudioContext | null>(null)
  const rendererRef = useRef<AudioWorkletNode | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const streamRef = useRef<TransportMediaStream | null>(null)
  const resumeAudioCleanupRef = useRef<(() => void) | null>(null)
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

    audioContextRef.current = audioCtx
    rendererRef.current = renderer
    resumeAudioCleanupRef.current?.()
    resumeAudioCleanupRef.current = keepAudioContextRunning(
      audioCtx,
      addLogEvent,
      () => isUnmountedRef.current,
    )

    addLogEvent(
      "AUDIO",
      audioCtx.state === "running"
        ? "Audio worklet started"
        : "Audio worklet started; waiting for playback resume",
    )

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
      resumeAudioCleanupRef.current?.()
      resumeAudioCleanupRef.current = null
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

function keepAudioContextRunning(
  audioCtx: AudioContext,
  addLogEvent: AudioLogEvent,
  isClosed: () => boolean,
) {
  let isCleanedUp = false
  let hasLoggedWaiting = false
  let previousStateChange = audioCtx.onstatechange

  const cleanup = () => {
    if (isCleanedUp) {
      return
    }

    isCleanedUp = true
    AUDIO_RESUME_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, resumeFromUserGesture, true)
    })
    audioCtx.onstatechange = previousStateChange
  }

  const resumeFromUserGesture = () => {
    void tryResume()
  }

  const tryResume = async () => {
    if (isCleanedUp || isClosed() || audioCtx.state === "closed") {
      cleanup()
      return
    }

    if (audioCtx.state !== "suspended") {
      cleanup()
      return
    }

    try {
      await Promise.race([audioCtx.resume(), wait(250)])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addLogEvent(
        "AUDIO",
        `Audio playback resume failed: ${errorMessage}`,
        "warn",
      )
    }

    if (isCleanedUp) {
      return
    }

    if ((audioCtx.state as AudioContextState) === "running") {
      addLogEvent("AUDIO", "Audio playback resumed")
      cleanup()
      return
    }

    if (!hasLoggedWaiting) {
      hasLoggedWaiting = true
      addLogEvent(
        "AUDIO",
        "Audio playback is waiting for a browser user gesture.",
        "warn",
      )
    }
  }

  previousStateChange = audioCtx.onstatechange
  audioCtx.onstatechange = (event) => {
    previousStateChange?.call(audioCtx, event)

    if ((audioCtx.state as AudioContextState) === "running") {
      addLogEvent("AUDIO", "Audio playback resumed")
      cleanup()
    }
  }

  AUDIO_RESUME_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, resumeFromUserGesture, {
      capture: true,
      passive: true,
    })
  })

  void tryResume()

  return cleanup
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
