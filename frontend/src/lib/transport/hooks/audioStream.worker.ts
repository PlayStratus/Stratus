/// <reference lib="webworker" />

import { readU32BE } from "../utils/chunkRingBuffer"
import { TransportPacketWorker } from "../utils/transportPacketWorker"
import { TransportStreamType } from "../types"

const SAMPLE_RATE = 48_000
const CHANNELS = 2
const FRAME_DURATION_US = 20_000
const AUDIO_MESSAGE_HEADER_BYTES = 5
const AUDIO_DECODER_CONFIG: AudioDecoderConfig = {
  codec: "opus",
  sampleRate: SAMPLE_RATE,
  numberOfChannels: CHANNELS,
}
const VERBOSE_AUDIO_FRAME_LOG_COUNT = 5
const AUDIO_FRAME_LOG_INTERVAL = 100

type AudioWorkerMessage =
  | { type: "init"; port: MessagePort }
  | { type: "chunk-batch"; chunks: ArrayBuffer[] }
  | { type: "close" }

type AudioWorkletMessage =
  | { type: "log"; message: string; severity?: "info" | "warn" | "error" }
  | {
      type: "render-stats"
      renderedBlocks: number
      underruns: number
      peak?: number
      rms?: number
      queuedFrames?: number
    }

type AudioMessageHeader = {
  streamType: TransportStreamType
  streamTypeLabel: string | number
  payloadLen: number
}

class AudioStreamWorker extends TransportPacketWorker<AudioWorkerMessage> {
  private decoder: AudioDecoder | null = null
  private workletPort: MessagePort | null = null
  private streamType: TransportStreamType | null = null
  private timestampUs = 0
  private hasLoggedDecoderUnavailable = false
  private pendingFrameReceivedAtMs: number[] = []
  private totalRenderLatencyMs = 0
  private renderedFrameCount = 0
  private receivedPacketCount = 0
  private decodedFrameCount = 0
  private postedFrameCount = 0

  constructor() {
    super(AUDIO_MESSAGE_HEADER_BYTES)
  }

  protected handleCustomMessage(message: AudioWorkerMessage) {
    if (message.type === "init") {
      this.workletPort = message.port
      this.workletPort.onmessage = (
        event: MessageEvent<AudioWorkletMessage>,
      ) => this.handleWorkletMessage(event.data)
      this.workletPort.start()
      this.postLog("Audio worklet port connected", "info")
    }
  }

  protected processFrames() {
    const currentDecoder = this.ensureDecoder()
    if (!currentDecoder || currentDecoder.state === "closed") {
      return
    }

    while (this.frameBuffer.byteLength >= AUDIO_MESSAGE_HEADER_BYTES) {
      const header = this.peekAudioHeader()
      if (!header) break

      if (
        this.frameBuffer.byteLength <
        AUDIO_MESSAGE_HEADER_BYTES + header.payloadLen
      ) {
        break
      }

      this.logAudioPacketHeader(header, currentDecoder)
      this.frameBuffer.discard(AUDIO_MESSAGE_HEADER_BYTES)

      if (header.payloadLen < 1) {
        continue
      }

      if (this.streamType === null) {
        this.streamType = header.streamType
        this.postLog(
          `[AUDIO] streamType=${header.streamTypeLabel} (${header.streamType})`,
          "info",
        )
      }

      if (header.streamType !== this.streamType) {
        this.postLog(
          `[AUDIO] Unexpected streamType=${header.streamTypeLabel} in audio frame; skipping ${header.payloadLen} bytes.`,
          "warn",
        )
        this.frameBuffer.discard(header.payloadLen)
        continue
      }

      try {
        const receivedAtMs = nowMs()
        const frameData = this.frameBuffer.take(header.payloadLen)
        const packetTimestampUs = this.timestampUs
        this.pendingFrameReceivedAtMs.push(receivedAtMs)
        currentDecoder.decode(
          new EncodedAudioChunk({
            type: "key",
            timestamp: packetTimestampUs,
            duration: FRAME_DURATION_US,
            data: frameData,
          }),
        )
        this.receivedPacketCount += 1
        this.logAudioDecodeQueued(packetTimestampUs, currentDecoder)
        this.timestampUs += FRAME_DURATION_US
      } catch (error) {
        this.pendingFrameReceivedAtMs.pop()
        this.postError(`Error decoding stream: ${errorToMessage(error)}`)
        this.resetDecoder()
        return
      }
    }
  }

  protected onClose() {
    if (this.decoder) {
      this.decoder.close()
      this.decoder = null
    }

    this.streamType = null
    this.timestampUs = 0
    this.receivedPacketCount = 0
    this.decodedFrameCount = 0
    this.postedFrameCount = 0
    this.resetMetrics()
    this.workletPort?.postMessage({ type: "close" })
    this.workletPort?.close()
    this.workletPort = null
  }

  private ensureDecoder() {
    if (this.decoder) {
      return this.decoder
    }

    if (typeof AudioDecoder === "undefined") {
      if (!this.hasLoggedDecoderUnavailable) {
        this.hasLoggedDecoderUnavailable = true
        this.postError("AudioDecoder API not available in this browser")
      }
      return null
    }

    this.decoder = new AudioDecoder({
      output: (frame) => {
        try {
          this.postFrame(frame)
        } finally {
          frame.close()
        }
      },
      error: (error) => {
        this.postError(`Error decoding stream: ${error.message}`)
        this.resetDecoder()
      },
    })

    this.decoder.configure(AUDIO_DECODER_CONFIG)
    this.postLog(
      `AudioDecoder configured codec=${AUDIO_DECODER_CONFIG.codec} sampleRate=${AUDIO_DECODER_CONFIG.sampleRate} channels=${AUDIO_DECODER_CONFIG.numberOfChannels}`,
      "info",
    )

    return this.decoder
  }

  private postFrame(frame: AudioData) {
    const receivedAtMs = this.pendingFrameReceivedAtMs.shift() ?? nowMs()
    const channels = frame.numberOfChannels
    const frames = frame.numberOfFrames
    const channelBuffers: ArrayBuffer[] = []
    let peak = 0
    let sumSquares = 0
    let sampleCount = 0
    this.decodedFrameCount += 1

    for (let channel = 0; channel < channels; channel++) {
      const channelData = new Float32Array(frames)
      frame.copyTo(channelData, {
        format: "f32-planar",
        planeIndex: channel,
      })
      for (const sample of channelData) {
        const magnitude = Math.abs(sample)
        if (magnitude > peak) {
          peak = magnitude
        }
        sumSquares += sample * sample
        sampleCount += 1
      }
      channelBuffers.push(channelData.buffer)
    }
    this.logDecodedFrame(
      frame,
      receivedAtMs,
      peak,
      sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
    )

    if (!this.workletPort) {
      this.postError("Audio worklet port is not initialized")
      return
    }

    this.workletPort.postMessage(
      {
        type: "frame",
        channels: channelBuffers,
        numberOfFrames: frames,
      },
      channelBuffers,
    )
    this.postedFrameCount += 1
    this.logPostedFrame(frames, channels)
    this.updateMetrics(receivedAtMs)
  }

  private resetDecoder() {
    if (this.decoder && this.decoder.state !== "closed") {
      this.decoder.reset()
    }
    this.timestampUs = 0
    this.receivedPacketCount = 0
    this.decodedFrameCount = 0
    this.postedFrameCount = 0
    this.resetMetrics()
    this.workletPort?.postMessage({ type: "reset" })
    this.postLog("Audio decoder reset; worklet buffer cleared", "warn")
  }

  private updateMetrics(receivedAtMs: number) {
    this.renderedFrameCount += 1
    this.totalRenderLatencyMs += Math.max(nowMs() - receivedAtMs, 0)

    globalThis.postMessage({
      type: "metrics",
      averageRenderTimeMs: this.totalRenderLatencyMs / this.renderedFrameCount,
    })
  }

  private resetMetrics() {
    this.pendingFrameReceivedAtMs = []
    this.totalRenderLatencyMs = 0
    this.renderedFrameCount = 0
  }

  private peekAudioHeader() {
    const header = this.frameBuffer.peek()
    if (!header) {
      return null
    }

    const streamType = header[0] as TransportStreamType

    return {
      streamType,
      streamTypeLabel: TransportStreamType[streamType] ?? streamType,
      payloadLen: readU32BE(header, 1),
    } satisfies AudioMessageHeader
  }

  private logAudioPacketHeader(
    header: AudioMessageHeader,
    decoder: AudioDecoder,
  ) {
    this.postLog(
      `Received audio packet header streamType=${header.streamTypeLabel} payloadBytes=${header.payloadLen} bufferedBytes=${this.frameBuffer.byteLength} decoderState=${decoder.state} decodeQueueSize=${decoder.decodeQueueSize}`,
      "info",
    )
  }

  private logAudioDecodeQueued(timestampUs: number, decoder: AudioDecoder) {
    if (!shouldLogFrame(this.receivedPacketCount)) {
      return
    }

    this.postLog(
      `Queued audio packet #${this.receivedPacketCount} timestampUs=${timestampUs} decodeQueueSize=${decoder.decodeQueueSize}`,
      "info",
    )
  }

  private logDecodedFrame(
    frame: AudioData,
    receivedAtMs: number,
    peak: number,
    rms: number,
  ) {
    if (!shouldLogFrame(this.decodedFrameCount)) {
      return
    }

    this.postLog(
      `Decoded audio frame #${this.decodedFrameCount} channels=${frame.numberOfChannels} frames=${frame.numberOfFrames} sampleRate=${frame.sampleRate} timestampUs=${frame.timestamp} peak=${peak.toFixed(5)} rms=${rms.toFixed(5)} latencyMs=${Math.max(nowMs() - receivedAtMs, 0).toFixed(1)}`,
      "info",
    )
  }

  private logPostedFrame(frames: number, channels: number) {
    if (!shouldLogFrame(this.postedFrameCount)) {
      return
    }

    this.postLog(
      `Posted audio frame #${this.postedFrameCount} to worklet channels=${channels} frames=${frames}`,
      "info",
    )
  }

  private handleWorkletMessage(message: AudioWorkletMessage) {
    if (message.type === "log") {
      this.postLog(`[worklet] ${message.message}`, message.severity ?? "info")
      return
    }

    if (message.type === "render-stats") {
      this.postLog(
        `[worklet] renderedBlocks=${message.renderedBlocks} underruns=${message.underruns} peak=${formatAudioLevel(message.peak)} rms=${formatAudioLevel(message.rms)} queuedFrames=${message.queuedFrames ?? "unknown"}`,
        message.underruns > 0 ? "warn" : "info",
      )
    }
  }
}

const audioStreamWorker = new AudioStreamWorker()

globalThis.onmessage = (event: MessageEvent<AudioWorkerMessage>) => {
  audioStreamWorker.handleMessage(event.data)
}

function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function nowMs() {
  return performance.timeOrigin + performance.now()
}

function shouldLogFrame(frameCount: number) {
  return (
    frameCount <= VERBOSE_AUDIO_FRAME_LOG_COUNT ||
    frameCount % AUDIO_FRAME_LOG_INTERVAL === 0
  )
}

function formatAudioLevel(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(5) : "unknown"
}
