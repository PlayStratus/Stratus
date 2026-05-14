/// <reference lib="webworker" />

import { readU32BE } from "../utils/chunkRingBuffer"
import { TransportPacketWorker } from "../utils/transportPacketWorker"
import { TransportStreamType, VideoMessageType } from "../types"

const FRAME_DURATION_US = Math.round(1_000_000 / 15)
const VIDEO_MESSAGE_HEADER_BYTES = 6
const MAX_DECODE_QUEUE_SIZE = 2
const MAX_BUFFERED_VIDEO_BYTES = 512 * 1024
const VIDEO_DECODER_CONFIG: VideoDecoderConfig = {
  codec: "avc1.42C01E",
  optimizeForLatency: true,
}

type VideoWorkerMessage =
  | { type: "init"; canvas: OffscreenCanvas }
  | { type: "chunk-batch"; chunks: ArrayBuffer[] }
  | { type: "close" }

type VideoMessageHeader = {
  streamType: TransportStreamType
  streamTypeLabel: string | number
  messageType: VideoMessageType
  messageTypeLabel: string | number
  chunkType: EncodedVideoChunkType
  payloadLen: number
}

class VideoStreamWorker extends TransportPacketWorker<VideoWorkerMessage> {
  private canvas: OffscreenCanvas | null = null
  private ctx: OffscreenCanvasRenderingContext2D | null = null
  private decoder: VideoDecoder | null = null
  private timestampUs = 0
  private droppingUntilKeyframe = false
  private hasLoggedDrop = false
  private hasSentStreamingStatus = false
  private totalRenderLatencyMs = 0
  private renderedFrameCount = 0
  private firstFrameRenderedAtMs: number | null = null
  private readonly chunkReceivedAtByTimestamp = new Map<number, number>()

  constructor() {
    super(VIDEO_MESSAGE_HEADER_BYTES)
  }

  protected handleCustomMessage(message: VideoWorkerMessage) {
    if (message.type === "init") {
      this.handleInit(message.canvas)
    }
  }

  protected processFrames() {
    const currentDecoder = this.ensureDecoder()
    if (!currentDecoder) {
      return
    }

    while (this.frameBuffer.byteLength >= VIDEO_MESSAGE_HEADER_BYTES) {
      const header = this.peekVideoHeader()
      if (!header) break

      if (
        this.frameBuffer.byteLength <
        VIDEO_MESSAGE_HEADER_BYTES + header.payloadLen
      ) {
        break
      }

      this.logVideoMessageHeader(header, currentDecoder)
      this.applyCongestionControlBeforeFrame(currentDecoder)
      this.frameBuffer.discard(VIDEO_MESSAGE_HEADER_BYTES)

      if (header.payloadLen < 1) {
        continue
      }

      if (this.shouldDropForCongestion(header)) {
        this.frameBuffer.discard(header.payloadLen)
        continue
      }

      const frameData = this.frameBuffer.take(header.payloadLen)
      this.recoverFromCongestionIfNeeded(currentDecoder)
      this.decodeFrame(currentDecoder, header, frameData)
    }
  }

  protected onClose() {
    if (this.decoder) {
      this.decoder.close()
      this.decoder = null
    }

    this.canvas = null
    this.ctx = null
  }

  private handleInit(nextCanvas: OffscreenCanvas) {
    this.canvas = nextCanvas
    this.ctx = this.canvas.getContext("2d")
    this.resetFrameBuffer()

    if (!this.ctx) {
      this.postLog("Could not get 2D context for OffscreenCanvas", "error")
    }
  }

  private ensureDecoder() {
    if (this.decoder) {
      return this.decoder
    }

    if (typeof VideoDecoder === "undefined") {
      this.postLog("VideoDecoder API not available in this browser", "error")
      return null
    }

    if (!this.canvas || !this.ctx) {
      this.postLog("Offscreen canvas is not ready for decoding", "error")
      return null
    }

    this.decoder = new VideoDecoder({
      output: (frame) => {
        this.renderFrame(frame)
      },
      error: (error) => {
        this.postLog(`VideoDecoder error: ${String(error)}`, "error")
      },
    })

    this.configureDecoder(this.decoder)

    return this.decoder
  }

  private configureDecoder(currentDecoder: VideoDecoder) {
    currentDecoder.configure(VIDEO_DECODER_CONFIG)
  }

  private decodeFrame(
    currentDecoder: VideoDecoder,
    header: VideoMessageHeader,
    frameData: Uint8Array,
  ) {
    const frameTimestampUs = this.timestampUs
    const chunk = new EncodedVideoChunk({
      type: header.chunkType,
      timestamp: frameTimestampUs,
      data: frameData,
    })
    this.timestampUs += FRAME_DURATION_US

    this.chunkReceivedAtByTimestamp.set(frameTimestampUs, nowMs())
    currentDecoder.decode(chunk)
  }

  private renderFrame(frame: VideoFrame) {
    if (!this.canvas || !this.ctx) {
      frame.close()
      return
    }

    if (this.canvas.width !== frame.codedWidth) {
      this.canvas.width = frame.codedWidth
    }
    if (this.canvas.height !== frame.codedHeight) {
      this.canvas.height = frame.codedHeight
    }

    try {
      const anyFrame = frame as VideoFrame & {
        transferToImageBitmap?: () => ImageBitmap
      }
      if (typeof anyFrame.transferToImageBitmap === "function") {
        const bitmap = anyFrame.transferToImageBitmap()
        this.ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
      } else {
        this.ctx.drawImage(frame, 0, 0)
      }
      this.updateMetrics(frame.timestamp)

      if (!this.hasSentStreamingStatus) {
        globalThis.postMessage({ type: "status", status: "STREAMING" })
        this.hasSentStreamingStatus = true
      }
    } finally {
      frame.close()
    }
  }

  private applyCongestionControlBeforeFrame(currentDecoder: VideoDecoder) {
    if (
      !this.droppingUntilKeyframe &&
      this.shouldEnterKeyframeDropMode(currentDecoder)
    ) {
      this.enterKeyframeDropMode()
    }
  }

  private shouldEnterKeyframeDropMode(currentDecoder: VideoDecoder) {
    return (
      currentDecoder.decodeQueueSize > MAX_DECODE_QUEUE_SIZE ||
      this.frameBuffer.byteLength > MAX_BUFFERED_VIDEO_BYTES
    )
  }

  private enterKeyframeDropMode() {
    this.droppingUntilKeyframe = true

    if (!this.hasLoggedDrop) {
      this.hasLoggedDrop = true
      this.postLog(
        "Video backlog detected; dropping stale frames until next keyframe.",
      )
    }
  }

  private shouldDropForCongestion(header: VideoMessageHeader) {
    return this.droppingUntilKeyframe && header.chunkType !== "key"
  }

  private recoverFromCongestionIfNeeded(currentDecoder: VideoDecoder) {
    if (!this.droppingUntilKeyframe) {
      return
    }

    currentDecoder.reset()
    this.configureDecoder(currentDecoder)
    this.timestampUs = 0
    this.droppingUntilKeyframe = false
  }

  private updateMetrics(frameTimestamp: number) {
    const receivedAtMs = this.chunkReceivedAtByTimestamp.get(frameTimestamp)
    this.chunkReceivedAtByTimestamp.delete(frameTimestamp)

    if (receivedAtMs === undefined) {
      return
    }

    const renderedAtMs = nowMs()
    this.firstFrameRenderedAtMs ??= renderedAtMs
    this.renderedFrameCount += 1
    this.totalRenderLatencyMs += renderedAtMs - receivedAtMs

    const elapsedSeconds = Math.max(
      (renderedAtMs - this.firstFrameRenderedAtMs) / 1000,
      1 / 1000,
    )

    globalThis.postMessage({
      type: "metrics",
      averageRenderTimeMs: this.totalRenderLatencyMs / this.renderedFrameCount,
      fps: this.renderedFrameCount / elapsedSeconds,
    })
  }

  private logVideoMessageHeader(
    header: VideoMessageHeader,
    currentDecoder: VideoDecoder,
  ) {
    this.postLog(
      [
        "Received video message header",
        `streamType=${header.streamTypeLabel}`,
        `messageType=${header.messageTypeLabel}`,
        `chunkType=${header.chunkType}`,
        `payloadBytes=${header.payloadLen}`,
        `bufferedBytes=${this.frameBuffer.byteLength}`,
        `decodeQueueSize=${currentDecoder.decodeQueueSize}`,
      ].join(" "),
    )
  }

  private peekVideoHeader() {
    const header = this.frameBuffer.peek()
    if (!header) {
      return null
    }

    const streamType = header[0] as TransportStreamType
    const messageType = header[1] as VideoMessageType

    return {
      streamType,
      streamTypeLabel: TransportStreamType[streamType] ?? streamType,
      messageType,
      messageTypeLabel: VideoMessageType[messageType] ?? messageType,
      chunkType:
        messageType === VideoMessageType.Codec_Description ? "key" : "delta",
      payloadLen: readU32BE(header, 2),
    } satisfies VideoMessageHeader
  }
}

const videoStreamWorker = new VideoStreamWorker()

globalThis.onmessage = (event: MessageEvent<VideoWorkerMessage>) => {
  videoStreamWorker.handleMessage(event.data)
}

function nowMs() {
  return performance.timeOrigin + performance.now()
}
