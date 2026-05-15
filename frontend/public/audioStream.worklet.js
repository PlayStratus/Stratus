class StratusAudioRenderer extends AudioWorkletProcessor {
  constructor() {
    super()

    this.frames = []
    this.currentFrameOffset = 0
    this.isClosed = false
    this.receivedFrameCount = 0
    this.renderedBlockCount = 0
    this.underrunCount = 0
    this.hasLoggedFirstFrame = false
    this.hasLoggedFirstRender = false
    this.port.onmessage = (event) => this.handlePortMessage(event)
  }

  process(_inputs, outputs) {
    const output = outputs[0]
    if (!output || this.isClosed) {
      return !this.isClosed
    }

    let written = 0
    const frameLength = output[0]?.length ?? 0

    while (written < frameLength) {
      const frame = this.frames[0]
      if (!frame) {
        this.logUnderrun()
        this.clearOutput(output, written)
        break
      }

      const available = frame.numberOfFrames - this.currentFrameOffset
      const toCopy = Math.min(frameLength - written, available)

      for (let channel = 0; channel < output.length; channel++) {
        const source = frame.channels[channel] ?? frame.channels[0]
        output[channel].set(
          source.subarray(
            this.currentFrameOffset,
            this.currentFrameOffset + toCopy,
          ),
          written,
        )
      }

      written += toCopy
      this.currentFrameOffset += toCopy

      if (this.currentFrameOffset >= frame.numberOfFrames) {
        this.frames.shift()
        this.currentFrameOffset = 0
      }
    }

    if (written > 0) {
      this.renderedBlockCount += 1

      if (!this.hasLoggedFirstRender) {
        this.hasLoggedFirstRender = true
        this.port.postMessage({
          type: "log",
          message: `rendered first audio block samples=${written} queuedFrames=${this.frames.length}`,
        })
      } else if (this.renderedBlockCount % 100 === 0) {
        this.port.postMessage({
          type: "render-stats",
          renderedBlocks: this.renderedBlockCount,
          underruns: this.underrunCount,
        })
      }
    }

    return true
  }

  handlePortMessage(event) {
    const message = event.data

    if (message.type === "frame") {
      this.receivedFrameCount += 1
      this.frames.push({
        channels: message.channels.map((buffer) => new Float32Array(buffer)),
        numberOfFrames: message.numberOfFrames,
      })

      if (!this.hasLoggedFirstFrame) {
        this.hasLoggedFirstFrame = true
        this.port.postMessage({
          type: "log",
          message: `received first decoded frame channels=${message.channels.length} frames=${message.numberOfFrames}`,
        })
      } else if (this.receivedFrameCount <= 5 || this.receivedFrameCount % 100 === 0) {
        this.port.postMessage({
          type: "log",
          message: `queued decoded frame #${this.receivedFrameCount} frames=${message.numberOfFrames} queuedFrames=${this.frames.length}`,
        })
      }
    } else if (message.type === "reset") {
      this.frames = []
      this.currentFrameOffset = 0
      this.receivedFrameCount = 0
      this.renderedBlockCount = 0
      this.underrunCount = 0
      this.hasLoggedFirstFrame = false
      this.hasLoggedFirstRender = false
      this.port.postMessage({
        type: "log",
        message: "reset audio render queue",
        severity: "warn",
      })
    } else if (message.type === "close") {
      this.isClosed = true
      this.frames = []
      this.currentFrameOffset = 0
    }
  }

  clearOutput(output, offset) {
    for (const channel of output) {
      channel.fill(0, offset)
    }
  }

  logUnderrun() {
    this.underrunCount += 1

    if (this.underrunCount === 1 || this.underrunCount % 200 === 0) {
      this.port.postMessage({
        type: "log",
        message: `audio render underrun count=${this.underrunCount}`,
        severity: "warn",
      })
    }
  }
}

registerProcessor("stratus-audio-renderer", StratusAudioRenderer)
