import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react"

import { useLogs } from "./logs"
import { TransportMediaStream } from "../utils/transportMediaStream"

const SAMPLE_RATE = 48_000
const CHANNELS = 2
const AUDIO_RESUME_EVENTS = [
  "click",
  "pointerdown",
  "keydown",
  "touchstart",
] as const

type AudioOutputSink = {
  destination: MediaStreamAudioDestinationNode
  element: HTMLAudioElement
}

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
  const audioOutputSinkRef = useRef<AudioOutputSink | null>(null)
  const resumeAudioCleanupRef = useRef<(() => void) | null>(null)
  const isUnmountedRef = useRef(false)

  const getAudioContext = useCallback(() => {
    const AudioContextConstructor = getAudioContextConstructor()

    if (!AudioContextConstructor) {
      addLogEvent("AUDIO", "AudioContext API not available", "error")
      return null
    }

    if (!("audioWorklet" in AudioContextConstructor.prototype)) {
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

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor({
        sampleRate: SAMPLE_RATE,
      })
      addLogEvent(
        "AUDIO",
        `AudioContext created state=${audioContextRef.current.state} sampleRate=${audioContextRef.current.sampleRate} baseLatency=${formatOptionalNumber(audioContextRef.current.baseLatency)} outputLatency=${formatOptionalNumber(audioContextRef.current.outputLatency)}`,
        "info",
      )
    }

    return audioContextRef.current
  }, [addLogEvent])

  const armAudioPlayback = useCallback(
    (audioCtx: AudioContext) => {
      resumeAudioCleanupRef.current?.()
      resumeAudioCleanupRef.current = keepAudioContextRunning(
        audioCtx,
        addLogEvent,
        () => isUnmountedRef.current,
      )
    },
    [addLogEvent],
  )

  const prepareAudioPlayback = useCallback(() => {
    const audioCtx = getAudioContext()
    if (!audioCtx) {
      return
    }

    const sink = ensureAudioOutputSink(audioCtx, audioOutputSinkRef, addLogEvent)
    if (sink) {
      void playAudioOutputSink(sink, addLogEvent)
    }

    armAudioPlayback(audioCtx)
    addLogEvent(
      "AUDIO",
      audioCtx.state === "running"
        ? "Audio playback armed"
        : "Audio playback arming requested",
    )
  }, [addLogEvent, armAudioPlayback, getAudioContext])

  const getRenderer = useCallback(async () => {
    if (rendererRef.current) {
      return rendererRef.current
    }

    const audioCtx = getAudioContext()
    if (!audioCtx) {
      return null
    }

    try {
      await loadAudioWorkletModule(audioCtx)
    } catch (error) {
      await audioCtx.close().catch(() => undefined)
      if (audioContextRef.current === audioCtx) {
        audioContextRef.current = null
      }
      throw error
    }

    const renderer = new AudioWorkletNode(audioCtx, "stratus-audio-renderer", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [CHANNELS],
    })

    const sink = ensureAudioOutputSink(audioCtx, audioOutputSinkRef, addLogEvent)
    if (sink) {
      renderer.connect(sink.destination)
      void playAudioOutputSink(sink, addLogEvent)
    } else {
      renderer.connect(audioCtx.destination)
    }

    addLogEvent(
      "AUDIO",
      sink
        ? `Audio worklet connected to iOS audio element sink maxChannelCount=${sink.destination.channelCount} channelCount=${sink.destination.channelCount} channelCountMode=${sink.destination.channelCountMode} channelInterpretation=${sink.destination.channelInterpretation}`
        : `Audio worklet connected to destination maxChannelCount=${audioCtx.destination.maxChannelCount} channelCount=${audioCtx.destination.channelCount} channelCountMode=${audioCtx.destination.channelCountMode} channelInterpretation=${audioCtx.destination.channelInterpretation}`,
      "info",
    )

    rendererRef.current = renderer
    armAudioPlayback(audioCtx)

    addLogEvent(
      "AUDIO",
      audioCtx.state === "running"
        ? "Audio worklet started"
        : "Audio worklet started; waiting for playback resume",
    )

    return renderer
  }, [addLogEvent, armAudioPlayback, getAudioContext])

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
      audioOutputSinkRef.current?.element.remove()
      audioOutputSinkRef.current = null
      void audioContextRef.current?.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [])

  return { handleAudioStreams, prepareAudioPlayback }
}

async function loadAudioWorkletModule(audioCtx: AudioContext) {
  await audioCtx.audioWorklet.addModule("/audioStream.worklet.js")
}

function getAudioContextConstructor() {
  return (
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext
    }).webkitAudioContext
  )
}

function ensureAudioOutputSink(
  audioCtx: AudioContext,
  sinkRef: RefObject<AudioOutputSink | null>,
  addLogEvent: AudioLogEvent,
) {
  if (!shouldUseHtmlAudioOutput()) {
    return null
  }

  if (sinkRef.current) {
    return sinkRef.current
  }

  const destination = audioCtx.createMediaStreamDestination()
  const element = document.createElement("audio")

  element.autoplay = true
  element.muted = false
  element.volume = 1
  element.srcObject = destination.stream
  element.setAttribute("playsinline", "")
  element.setAttribute("webkit-playsinline", "")
  element.style.display = "none"
  document.body.appendChild(element)

  sinkRef.current = { destination, element }
  addLogEvent(
    "AUDIO",
    `Audio element output sink created tracks=${destination.stream.getAudioTracks().length}`,
    "info",
  )

  return sinkRef.current
}

async function playAudioOutputSink(
  sink: AudioOutputSink,
  addLogEvent: AudioLogEvent,
) {
  try {
    await sink.element.play()
    addLogEvent("AUDIO", "Audio element output sink armed", "info")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    addLogEvent(
      "AUDIO",
      `Audio element output sink is waiting for a browser user gesture: ${errorMessage}`,
      "warn",
    )
  }
}

function shouldUseHtmlAudioOutput() {
  const navigator = globalThis.navigator
  const userAgent = navigator.userAgent
  const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent)
  const isIPadOSDesktopMode =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1

  return isIOSDevice || isIPadOSDesktopMode
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

function formatOptionalNumber(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(4) : "unknown"
}
