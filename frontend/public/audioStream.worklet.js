class StratusAudioRenderer extends AudioWorkletProcessor {
  constructor() {
    super()

    this.frames = []
    this.currentFrameOffset = 0
    this.isClosed = false
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

    return true
  }

  handlePortMessage(event) {
    const message = event.data

    if (message.type === "frame") {
      this.frames.push({
        channels: message.channels.map((buffer) => new Float32Array(buffer)),
        numberOfFrames: message.numberOfFrames,
      })
    } else if (message.type === "reset") {
      this.frames = []
      this.currentFrameOffset = 0
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
}

registerProcessor("stratus-audio-renderer", StratusAudioRenderer)
