const DEFAULT_MAX_CHUNK_BATCH_COUNT = 8
const DEFAULT_MAX_CHUNK_BATCH_BYTES = 128 * 1024
const DEFAULT_CHUNK_BATCH_DELAY_MS = 8

type TransportMediaStreamOptions = {
  worker: Worker
  label: string
  onOpen: () => void
  onClose: () => void
  onError: (message: string) => void
  isClosed?: () => boolean
  maxChunkBatchCount?: number
  maxChunkBatchBytes?: number
  chunkBatchDelayMs?: number
}

export class TransportMediaStream {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private pendingChunks: ArrayBuffer[] = []
  private pendingChunkBytes = 0
  private flushTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: TransportMediaStreamOptions) {}

  get isActive() {
    return this.reader !== null
  }

  async start(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    initialChunk: Uint8Array,
  ) {
    if (this.reader) {
      await reader.cancel().catch(() => undefined)
      reader.releaseLock()
      return
    }

    this.reader = reader

    try {
      this.options.onOpen()
      this.queueChunk(initialChunk)

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          this.flushPendingChunks()
          this.options.onClose()
          return
        }

        if (!value?.length) continue
        this.queueChunk(value)
      }
    } catch (error) {
      if (!this.options.isClosed?.()) {
        this.options.onError(
          `${this.options.label} stream error: ${errorToMessage(error)}`,
        )
      }
    } finally {
      this.clearFlushTimer()
      this.flushPendingChunks()
      this.reader = null
      reader.releaseLock()
    }
  }

  close() {
    this.clearFlushTimer()
    void this.reader?.cancel().catch(() => undefined)
  }

  private queueChunk(value: Uint8Array) {
    if (value.length === 0) {
      return
    }

    const chunk = toTransferableBuffer(value)
    this.pendingChunks.push(chunk)
    this.pendingChunkBytes += chunk.byteLength

    if (
      this.pendingChunks.length >= this.maxChunkBatchCount ||
      this.pendingChunkBytes >= this.maxChunkBatchBytes
    ) {
      this.clearFlushTimer()
      this.flushPendingChunks()
      return
    }

    if (!this.flushTimeoutId) {
      this.flushTimeoutId = setTimeout(() => {
        this.flushTimeoutId = null
        this.flushPendingChunks()
      }, this.chunkBatchDelayMs)
    }
  }

  private flushPendingChunks() {
    if (this.pendingChunks.length === 0) {
      return
    }

    const chunks = this.pendingChunks
    this.pendingChunks = []
    this.pendingChunkBytes = 0
    this.options.worker.postMessage({ type: "chunk-batch", chunks }, chunks)
  }

  private clearFlushTimer() {
    if (!this.flushTimeoutId) {
      return
    }

    clearTimeout(this.flushTimeoutId)
    this.flushTimeoutId = null
  }

  private get maxChunkBatchCount() {
    return this.options.maxChunkBatchCount ?? DEFAULT_MAX_CHUNK_BATCH_COUNT
  }

  private get maxChunkBatchBytes() {
    return this.options.maxChunkBatchBytes ?? DEFAULT_MAX_CHUNK_BATCH_BYTES
  }

  private get chunkBatchDelayMs() {
    return this.options.chunkBatchDelayMs ?? DEFAULT_CHUNK_BATCH_DELAY_MS
  }
}

function toTransferableBuffer(value: Uint8Array) {
  if (
    value.buffer instanceof ArrayBuffer &&
    value.byteOffset === 0 &&
    value.byteLength === value.buffer.byteLength
  ) {
    return value.buffer
  }

  return value.slice().buffer
}

function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
