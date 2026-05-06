import { useCallback, useEffect, useRef } from "react"

import {
  AudioStreamDecoder,
  type DecodedAudioFrame,
} from "./audioStreamDecoder"
import { useLogs } from "./logs"

const SAMPLE_RATE = 48_000
const CHANNELS = 2
const MAX_CHUNK_BATCH_COUNT = 8
const MAX_CHUNK_BATCH_BYTES = 128 * 1024
const CHUNK_BATCH_DELAY_MS = 8

export function useAudioStream() {
  const { addLogEvent } = useLogs()
  const audioContextRef = useRef<AudioContext | null>(null)
  const rendererRef = useRef<AudioWorkletNode | null>(null)
  const decoderRef = useRef<AudioStreamDecoder | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const isUnmountedRef = useRef(false)

  const closeDecoder = useCallback(() => {
    decoderRef.current?.close()
    decoderRef.current = null
  }, [])

  const postDecodedAudioFrame = useCallback((frame: DecodedAudioFrame) => {
    const renderer = rendererRef.current
    if (!renderer) {
      return
    }

    renderer.port.postMessage(
      {
        type: "frame",
        channels: frame.channels,
        numberOfFrames: frame.numberOfFrames,
      },
      frame.channels,
    )
  }, [])

  const postAudioReset = useCallback(() => {
    rendererRef.current?.port.postMessage({ type: "reset" })
  }, [])

  const getDecoder = useCallback(() => {
    if (decoderRef.current) {
      return decoderRef.current
    }

    const decoder = new AudioStreamDecoder({
      onFrame: postDecodedAudioFrame,
      onReset: postAudioReset,
      onLog: (message, severity) => addLogEvent("AUDIO", message, severity),
      onError: (message) => addLogEvent("AUDIO", message, "error"),
    })
    decoderRef.current = decoder

    return decoder
  }, [addLogEvent, postAudioReset, postDecodedAudioFrame])

  const handleChunkBatch = useCallback(
    (chunks: Uint8Array[]) => {
      getDecoder().decodeChunks(chunks)
    },
    [getDecoder],
  )

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

      if (!renderer || readerRef.current) {
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
        return
      }

      readerRef.current = reader

      let pendingChunks: Uint8Array[] = []
      let pendingChunkBytes = 0
      let flushTimeoutId: ReturnType<typeof setTimeout> | null = null

      const flushPendingChunks = () => {
        flushTimeoutId = null

        if (pendingChunks.length === 0) {
          return
        }

        const chunks = pendingChunks
        pendingChunks = []
        pendingChunkBytes = 0
        handleChunkBatch(chunks)
      }

      const queueChunk = (value: Uint8Array) => {
        if (value.length === 0) {
          return
        }

        pendingChunks.push(value)
        pendingChunkBytes += value.byteLength

        if (
          pendingChunks.length >= MAX_CHUNK_BATCH_COUNT ||
          pendingChunkBytes >= MAX_CHUNK_BATCH_BYTES
        ) {
          if (flushTimeoutId) {
            clearTimeout(flushTimeoutId)
          }
          flushPendingChunks()
          return
        }

        if (!flushTimeoutId) {
          flushTimeoutId = setTimeout(() => {
            flushPendingChunks()
          }, CHUNK_BATCH_DELAY_MS)
        }
      }

      try {
        addLogEvent("AUDIO", "Audio stream opened")

        queueChunk(initialChunk)

        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            if (flushTimeoutId) {
              clearTimeout(flushTimeoutId)
              flushPendingChunks()
            } else if (pendingChunks.length > 0) {
              flushPendingChunks()
            }
            addLogEvent("AUDIO", "Audio stream closed")
            return
          }
          if (!value?.length) continue

          queueChunk(value)
        }
      } catch (error) {
        if (!isUnmountedRef.current) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          addLogEvent("AUDIO", `Audio stream error: ${errorMessage}`, "error")
        }
      } finally {
        if (flushTimeoutId) {
          clearTimeout(flushTimeoutId)
          flushPendingChunks()
        }
        readerRef.current = null
        reader.releaseLock()
      }
    },
    [addLogEvent, getRenderer, handleChunkBatch],
  )

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true
      void readerRef.current?.cancel().catch(() => undefined)
      closeDecoder()
      rendererRef.current?.disconnect()
      rendererRef.current?.port.postMessage({ type: "close" })
      rendererRef.current?.port.close()
      rendererRef.current = null
      void audioContextRef.current?.close().catch(() => undefined)
      audioContextRef.current = null
    }
  }, [closeDecoder])

  return { handleAudioStreams }
}

async function loadAudioWorkletModule(audioCtx: AudioContext) {
  await audioCtx.audioWorklet.addModule("/audioStream.worklet.js")
}
