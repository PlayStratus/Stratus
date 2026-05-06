import RingBuffer from "ringbufferjs"

import { TransportStreamType } from "../types"

const SAMPLE_RATE = 48_000
const CHANNELS = 2
const FRAME_DURATION_US = 20_000
const INITIAL_CHUNK_CAPACITY = 128
const AUDIO_MESSAGE_HEADER_BYTES = 5
const AUDIO_DECODER_CONFIG: AudioDecoderConfig = {
  codec: "opus",
  sampleRate: SAMPLE_RATE,
  numberOfChannels: CHANNELS,
}

type AudioStreamDecoderLogSeverity = "info" | "log" | "warn" | "error"

type AudioMessageHeader = {
  streamType: TransportStreamType
  streamTypeLabel: string | number
  payloadLen: number
}

export type DecodedAudioFrame = {
  channels: ArrayBuffer[]
  numberOfFrames: number
}

type AudioStreamDecoderOptions = {
  onFrame: (frame: DecodedAudioFrame) => void
  onReset: () => void
  onLog: (message: string, severity?: AudioStreamDecoderLogSeverity) => void
  onError: (message: string) => void
}

export class AudioStreamDecoder {
  private decoder: AudioDecoder | null = null
  private frameBuffer = new ChunkRingBuffer()
  private streamType: TransportStreamType | null = null
  private timestampUs = 0
  private isProcessingFrames = false
  private hasLoggedDecoderUnavailable = false

  constructor(private readonly options: AudioStreamDecoderOptions) {}

  decodeChunks(chunks: Uint8Array[]) {
    for (const chunk of chunks) {
      this.frameBuffer.push(chunk)
    }

    this.processFrames()
  }

  close() {
    const decoder = this.decoder
    this.decoder = null

    if (decoder && decoder.state !== "closed") {
      void decoder
        .flush()
        .catch(() => undefined)
        .finally(() => {
          if (decoder.state !== "closed") {
            decoder.close()
          }
        })
    }

    this.frameBuffer = new ChunkRingBuffer()
    this.streamType = null
    this.timestampUs = 0
  }

  private processFrames() {
    if (this.isProcessingFrames) {
      return
    }

    this.isProcessingFrames = true

    try {
      const decoder = this.ensureDecoder()
      if (!decoder || decoder.state === "closed") {
        return
      }

      while (this.frameBuffer.byteLength >= AUDIO_MESSAGE_HEADER_BYTES) {
        const header = this.frameBuffer.peekHeader()
        if (!header) break

        if (
          this.frameBuffer.byteLength <
          AUDIO_MESSAGE_HEADER_BYTES + header.payloadLen
        ) {
          break
        }

        this.frameBuffer.discard(AUDIO_MESSAGE_HEADER_BYTES)

        if (header.payloadLen < 1) {
          continue
        }

        if (this.streamType === null) {
          this.streamType = header.streamType
          this.options.onLog(
            `[AUDIO] streamType=${header.streamTypeLabel} (${header.streamType})`,
            "info",
          )
        }

        if (header.streamType !== this.streamType) {
          this.options.onLog(
            `[AUDIO] Unexpected streamType=${header.streamTypeLabel} in audio frame; skipping ${header.payloadLen} bytes.`,
            "warn",
          )
          this.frameBuffer.discard(header.payloadLen)
          continue
        }

        try {
          decoder.decode(
            new EncodedAudioChunk({
              type: "key",
              timestamp: this.timestampUs,
              duration: FRAME_DURATION_US,
              data: this.frameBuffer.take(header.payloadLen),
            }),
          )
          this.timestampUs += FRAME_DURATION_US
        } catch (error) {
          this.options.onError(`Error decoding stream: ${errorToMessage(error)}`)
          this.resetDecoder()
          return
        }
      }
    } finally {
      this.isProcessingFrames = false
    }
  }

  private ensureDecoder() {
    if (this.decoder) {
      return this.decoder
    }

    if (typeof AudioDecoder === "undefined") {
      if (!this.hasLoggedDecoderUnavailable) {
        this.hasLoggedDecoderUnavailable = true
        this.options.onError("AudioDecoder API not available in this browser")
      }
      return null
    }

    this.decoder = new AudioDecoder({
      output: (frame) => {
        try {
          this.playFrame(frame)
        } finally {
          frame.close()
        }
      },
      error: (error) => {
        this.options.onError(`Error decoding stream: ${error.message}`)
      },
    })

    this.decoder.configure(AUDIO_DECODER_CONFIG)

    return this.decoder
  }

  private playFrame(frame: AudioData) {
    const channels = frame.numberOfChannels
    const frames = frame.numberOfFrames
    const channelBuffers: ArrayBuffer[] = []

    for (let channel = 0; channel < channels; channel++) {
      const channelData = new Float32Array(frames)
      frame.copyTo(channelData, {
        format: "f32-planar",
        planeIndex: channel,
      })
      channelBuffers.push(channelData.buffer)
    }

    this.options.onFrame({
      channels: channelBuffers,
      numberOfFrames: frames,
    })
  }

  private resetDecoder() {
    if (this.decoder && this.decoder.state !== "closed") {
      this.decoder.reset()
    }
    this.timestampUs = 0
    this.options.onReset()
  }
}

function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
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
  private readonly headerScratch = new Uint8Array(AUDIO_MESSAGE_HEADER_BYTES)

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
    if (this.bufferedBytes < AUDIO_MESSAGE_HEADER_BYTES) {
      return null
    }

    this.copyInto(this.headerScratch, AUDIO_MESSAGE_HEADER_BYTES)
    const streamType = this.headerScratch[0] as TransportStreamType

    return {
      streamType,
      streamTypeLabel: TransportStreamType[streamType] ?? streamType,
      payloadLen: readU32BE(this.headerScratch, 1),
    } satisfies AudioMessageHeader
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
      throw new Error("Attempted to consume more audio bytes than available")
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
