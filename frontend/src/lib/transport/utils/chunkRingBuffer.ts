import RingBuffer from "ringbufferjs"

const INITIAL_CHUNK_CAPACITY = 128

export class ChunkRingBuffer {
  private chunks = new RingBuffer<Uint8Array>(INITIAL_CHUNK_CAPACITY)
  private bufferedBytes = 0
  private headOffset = 0
  private readonly headerScratch: Uint8Array

  constructor(headerBytes: number) {
    this.headerScratch = new Uint8Array(headerBytes)
  }

  get byteLength() {
    return this.bufferedBytes
  }

  peek(length = this.headerScratch.length) {
    if (this.bufferedBytes < length) {
      return null
    }

    const out =
      length === this.headerScratch.length
        ? this.headerScratch
        : new Uint8Array(length)
    this.copyInto(out, length)
    return out
  }

  push(chunk: Uint8Array) {
    if (chunk.length === 0) return

    if (this.chunks.isFull()) {
      this.grow()
    }

    this.chunks.enq(chunk)
    this.bufferedBytes += chunk.length
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

export function readU32BE(buffer: Uint8Array, offset: number) {
  return (
    ((buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3]) >>>
    0
  )
}
