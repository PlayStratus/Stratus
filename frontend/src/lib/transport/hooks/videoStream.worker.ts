/// <reference lib="webworker" />

import RingBuffer from "ringbufferjs"

import { TransportStreamType, VideoMessageType } from "../types"

const FRAME_DURATION_US = Math.round(1_000_000 / 15)
const INITIAL_CHUNK_CAPACITY = 128
const VIDEO_MESSAGE_HEADER_BYTES = 6
const MAX_DECODE_QUEUE_SIZE = 2
const MAX_BUFFERED_VIDEO_BYTES = 512 * 1024
const VIDEO_DECODER_CONFIG: VideoDecoderConfig = {
  codec: "avc1.42C01E",
  optimizeForLatency: true,
}

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let decoder: VideoDecoder | null = null
let frameBuffer!: ChunkRingBuffer
let activeStream: number | null = null
let timestampUs = 0
let droppingUntilKeyframe = false
let hasLoggedDrop = false
let hasSentStreamingStatus = false
let totalRenderLatencyMs = 0
let renderedFrameCount = 0
let firstFrameRenderedAtMs: number | null = null
const chunkReceivedAtByTimestamp = new Map<number, number>()
let isClosed = false

globalThis.onmessage = (event: MessageEvent<any>) => {
  if (isClosed) return

  const message = event.data

  switch (message.type) {
    case "init":
      handleInit(message.canvas)
      return

    case "stream-start":
      handleStreamStart(message.stream)
      return

    case "stream-end":
      if (message.stream === activeStream) {
        resetStreamState()
      }
      return

    case "chunk-batch":
      if (message.stream !== activeStream) {
        return
      }

      for (const chunk of message.chunks) {
        frameBuffer.push(new Uint8Array(chunk))
      }
      processFrames()
      return

    case "close":
      closeWorker()
      return
  }
}

function handleInit(nextCanvas: OffscreenCanvas) {
  canvas = nextCanvas
  ctx = canvas.getContext("2d")
  frameBuffer = new ChunkRingBuffer()

  if (!ctx) {
    postLog("Could not get 2D context for OffscreenCanvas", "error")
  }
}

function handleStreamStart(stream: number) {
  if (activeStream === stream) {
    return
  }

  activeStream = stream
  resetStreamState()
}

function processFrames() {
  const currentDecoder = ensureDecoder()
  if (!currentDecoder) {
    return
  }

  while (frameBuffer.byteLength >= VIDEO_MESSAGE_HEADER_BYTES) {
    const header = frameBuffer.peekHeader()
    if (!header) break

    if (frameBuffer.byteLength < VIDEO_MESSAGE_HEADER_BYTES + header.payloadLen) {
      break
    }

    postLog(
      [
        `Received video message header on stream #${activeStream ?? "unknown"}`,
        `streamType=${header.streamTypeLabel}`,
        `messageType=${header.messageTypeLabel}`,
        `chunkType=${header.chunkType}`,
        `payloadBytes=${header.payloadLen}`,
        `bufferedBytes=${frameBuffer.byteLength}`,
        `decodeQueueSize=${currentDecoder.decodeQueueSize}`,
      ].join(" "),
    )

    if (
      !droppingUntilKeyframe &&
      (currentDecoder.decodeQueueSize > MAX_DECODE_QUEUE_SIZE ||
        frameBuffer.byteLength > MAX_BUFFERED_VIDEO_BYTES)
    ) {
      droppingUntilKeyframe = true

      if (!hasLoggedDrop) {
        hasLoggedDrop = true
        postLog(
          "Video backlog detected; dropping stale frames until next keyframe.",
        )
      }
    }

    frameBuffer.discard(VIDEO_MESSAGE_HEADER_BYTES)

    if (header.payloadLen < 1) {
      continue
    }

    if (droppingUntilKeyframe && header.chunkType !== "key") {
      frameBuffer.discard(header.payloadLen)
      continue
    }

    const frameData = frameBuffer.take(header.payloadLen)

    if (droppingUntilKeyframe) {
      currentDecoder.reset()
      configureDecoder(currentDecoder)
      timestampUs = 0
      droppingUntilKeyframe = false
    }

    const frameTimestampUs = timestampUs
    const chunk = new EncodedVideoChunk({
      type: header.chunkType,
      timestamp: frameTimestampUs,
      data: frameData,
    })
    timestampUs += FRAME_DURATION_US

    chunkReceivedAtByTimestamp.set(frameTimestampUs, nowMs())
    currentDecoder.decode(chunk)
  }
}

function ensureDecoder() {
  if (decoder) {
    return decoder
  }

  if (typeof VideoDecoder === "undefined") {
    postLog("VideoDecoder API not available in this browser", "error")
    return null
  }

  if (!canvas || !ctx) {
    postLog("Offscreen canvas is not ready for decoding", "error")
    return null
  }

  decoder = new VideoDecoder({
    output: (frame) => {
      if (!canvas || !ctx) {
        frame.close()
        return
      }

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
        updateMetrics(frame.timestamp)

        if (!hasSentStreamingStatus) {
          globalThis.postMessage({ type: "status", status: "STREAMING" })
          hasSentStreamingStatus = true
        }
      } finally {
        frame.close()
      }
    },
    error: (error) => {
      postLog(`VideoDecoder error: ${String(error)}`, "error")
    },
  })

  configureDecoder(decoder)

  return decoder
}

function configureDecoder(currentDecoder: VideoDecoder) {
  currentDecoder.configure(VIDEO_DECODER_CONFIG)
}

function resetStreamState() {
  frameBuffer = new ChunkRingBuffer()
  timestampUs = 0
  droppingUntilKeyframe = false
  hasLoggedDrop = false
  hasSentStreamingStatus = false
  resetMetrics()

  if (decoder) {
    decoder.reset()
  }
}

function closeWorker() {
  isClosed = true

  if (decoder) {
    decoder.close()
    decoder = null
  }

  canvas = null
  ctx = null
  activeStream = null
  frameBuffer = new ChunkRingBuffer()
  globalThis.close()
}

function updateMetrics(frameTimestamp: number) {
  const receivedAtMs = chunkReceivedAtByTimestamp.get(frameTimestamp)
  chunkReceivedAtByTimestamp.delete(frameTimestamp)

  if (receivedAtMs === undefined) {
    return
  }

  const renderedAtMs = nowMs()
  firstFrameRenderedAtMs ??= renderedAtMs
  renderedFrameCount += 1
  totalRenderLatencyMs += renderedAtMs - receivedAtMs

  const elapsedSeconds = Math.max(
    (renderedAtMs - firstFrameRenderedAtMs) / 1000,
    1 / 1000,
  )

  globalThis.postMessage({
    type: "metrics",
    averageRenderTimeMs: totalRenderLatencyMs / renderedFrameCount,
    fps: renderedFrameCount / elapsedSeconds,
  })
}

function resetMetrics() {
  totalRenderLatencyMs = 0
  renderedFrameCount = 0
  firstFrameRenderedAtMs = null
  chunkReceivedAtByTimestamp.clear()

  globalThis.postMessage({
    type: "metrics",
    averageRenderTimeMs: 0,
    fps: 0,
  })
}

function nowMs() {
  return performance.timeOrigin + performance.now()
}

function postLog(message: string, severity: "info" | "error" = "info") {
  globalThis.postMessage({ type: "log", message, severity })
}

function readU32BE(buffer: Uint8Array, offset: number) {
  return (
    ((buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]) >>>
    0
  )
}

class ChunkRingBuffer {
  private chunks = new RingBuffer<Uint8Array>(INITIAL_CHUNK_CAPACITY)
  private bufferedBytes = 0
  private headOffset = 0
  private readonly headerScratch = new Uint8Array(VIDEO_MESSAGE_HEADER_BYTES)

  get byteLength() {
    return this.bufferedBytes
  }

  push(chunk: Uint8Array) {
    if (chunk.length === 0) return

    if (this.chunks.isFull()) {
      this.grow()
    }

    this.chunks.enq(chunk)
    this.bufferedBytes += chunk.length
  }

  peekHeader() {
    if (this.bufferedBytes < VIDEO_MESSAGE_HEADER_BYTES) {
      return null
    }

    this.copyInto(this.headerScratch, VIDEO_MESSAGE_HEADER_BYTES)
    const streamType = this.headerScratch[0] as TransportStreamType
    const messageType = this.headerScratch[1] as VideoMessageType

    return {
      streamType,
      streamTypeLabel: TransportStreamType[streamType] ?? streamType,
      messageType,
      messageTypeLabel: VideoMessageType[messageType] ?? messageType,
      chunkType:
        messageType === VideoMessageType.Codec_Description ? "key" : "delta",
      payloadLen: readU32BE(this.headerScratch, 2),
    } satisfies {
      streamType: TransportStreamType
      streamTypeLabel: string | number
      messageType: VideoMessageType
      messageTypeLabel: string | number
      chunkType: EncodedVideoChunkType
      payloadLen: number
    }
  }

  discard(length: number) {
    this.consume(length)
  }

  take(length: number) {
    const chunk = this.chunks.peek()
    const available = chunk.length - this.headOffset

    if (available >= length) {
      const out = chunk.subarray(this.headOffset, this.headOffset + length)
      this.consume(length)
      return out
    }

    const out = new Uint8Array(length)
    this.consume(length, out)
    return out
  }

  private consume(length: number, target?: Uint8Array) {
    if (length > this.bufferedBytes) {
      throw new Error("Attempted to consume more bytes than available")
    }

    let written = 0

    while (written < length) {
      const chunk = this.chunks.peek()
      const available = chunk.length - this.headOffset
      const toCopy = Math.min(length - written, available)

      if (target) {
        target.set(
          chunk.subarray(this.headOffset, this.headOffset + toCopy),
          written,
        )
      }

      written += toCopy
      this.headOffset += toCopy
      this.bufferedBytes -= toCopy

      if (this.headOffset >= chunk.length) {
        this.chunks.deq()
        this.headOffset = 0
      }
    }
  }

  private copyInto(target: Uint8Array, length: number) {
    let written = 0

    this.forEachChunk((chunk, offset) => {
      const toCopy = Math.min(length - written, chunk.length - offset)
      target.set(chunk.subarray(offset, offset + toCopy), written)
      written += toCopy

      return written < length
    })
  }

  private forEachChunk(
    visitor: (chunk: Uint8Array, offset: number) => boolean,
  ) {
    let offset = this.headOffset
    let index = this.chunks._first
    let remaining = this.chunks._size

    while (remaining > 0) {
      const chunk = this.chunks._elements[index]
      if (!chunk) {
        break
      }

      if (!visitor(chunk, offset)) {
        break
      }

      offset = 0
      index = (index + 1) % this.chunks.capacity()
      remaining -= 1
    }
  }

  private grow() {
    const next = new RingBuffer<Uint8Array>(this.chunks.capacity() * 2)
    this.forEachChunk((chunk, offset) => {
      next.enq(chunk.subarray(offset))
      return true
    })
    this.chunks = next
    this.headOffset = 0
  }
}
