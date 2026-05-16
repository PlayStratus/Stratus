/// <reference lib="webworker" />

import { ChunkRingBuffer } from "./chunkRingBuffer"

type PacketWorkerMessage = {
  type: string
  chunks?: ArrayBuffer[]
}

type LogSeverity = "info" | "warn" | "error"

export abstract class TransportPacketWorker<
  TMessage extends PacketWorkerMessage,
> {
  protected frameBuffer: ChunkRingBuffer
  protected isClosed = false
  private isProcessingFrames = false

  protected constructor(private readonly headerBytes: number) {
    this.frameBuffer = new ChunkRingBuffer(headerBytes)
  }

  handleMessage(message: TMessage) {
    if (this.isClosed) return

    switch (message.type) {
      case "chunk-batch":
        this.handleChunkBatch(message.chunks ?? [])
        return

      case "close":
        this.close()
        return

      default:
        this.handleCustomMessage(message)
        return
    }
  }

  protected resetFrameBuffer() {
    this.frameBuffer = new ChunkRingBuffer(this.headerBytes)
  }

  protected postLog(message: string, severity: LogSeverity = "info") {
    globalThis.postMessage({ type: "log", message, severity })
  }

  protected postError(message: string) {
    globalThis.postMessage({ type: "error", message })
  }

  protected close() {
    this.isClosed = true
    this.onClose()
    this.resetFrameBuffer()
    globalThis.close()
  }

  protected handleCustomMessage(_message: TMessage) {
    // Subclasses can override to handle additional message types
  }

  protected abstract processFrames(): void

  protected abstract onClose(): void

  private handleChunkBatch(chunks: ArrayBuffer[]) {
    for (const chunk of chunks) {
      this.frameBuffer.push(new Uint8Array(chunk))
    }

    this.runProcessFrames()
  }

  private runProcessFrames() {
    if (this.isProcessingFrames) {
      return
    }

    this.isProcessingFrames = true

    try {
      this.processFrames()
    } finally {
      this.isProcessingFrames = false
    }
  }
}
