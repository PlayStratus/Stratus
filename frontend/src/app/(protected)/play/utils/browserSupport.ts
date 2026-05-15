export type BrowserRequirementKey =
  | "chromiumBrowser"
  | "webTransport"
  | "webCodecsAvc"
  | "webCodecsOpus"
  | "audioWorklet"
  | "gamepad"

export type BrowserRequirementStatus = "checking" | "supported" | "unsupported"

export interface BrowserRequirement {
  key: BrowserRequirementKey
  label: string
  status: BrowserRequirementStatus
  detail: string
}

export interface BrowserSupportReport {
  allSupported: boolean
  requirements: BrowserRequirement[]
}

const defaultRequirements: BrowserRequirement[] = [
  {
    key: "chromiumBrowser",
    label: "Chromium browser",
    status: "checking",
    detail: "Checking for a Chromium-based browser.",
  },
  {
    key: "webTransport",
    label: "WebTransport",
    status: "checking",
    detail: "Checking for the WebTransport API.",
  },
  {
    key: "webCodecsAvc",
    label: "WebCodecs AVC decoder (avc1.42C01E)",
    status: "checking",
    detail: "Checking WebCodecs and H.264 decoder support.",
  },
  {
    key: "webCodecsOpus",
    label: "WebCodecs Opus decoder",
    status: "checking",
    detail: "Checking WebCodecs and Opus decoder support.",
  },
  {
    key: "audioWorklet",
    label: "AudioWorklet",
    status: "checking",
    detail: "Checking for the AudioWorklet API.",
  },
  {
    key: "gamepad",
    label: "Gamepad API",
    status: "checking",
    detail: "Checking for gamepad input support.",
  },
]

export function createPendingBrowserSupportReport(): BrowserSupportReport {
  return {
    allSupported: false,
    requirements: defaultRequirements.map((requirement) => ({
      ...requirement,
    })),
  }
}

export async function checkPlayPageBrowserSupport(): Promise<BrowserSupportReport> {
  const requirements = createPendingBrowserSupportReport().requirements

  const iosBrowser = isIOSBrowser()
  const browserSupported = iosBrowser || isChromiumBrowser()
  updateRequirement(requirements, "chromiumBrowser", {
    status: browserSupported ? "supported" : "unsupported",
    detail: iosBrowser
      ? "An iOS/WebKit browser was detected."
      : browserSupported
        ? "A Chromium-based browser was detected."
        : "Stratus currently requires a Chromium-based browser or iOS/WebKit with WebTransport support.",
  })

  const webTransportSupported = typeof WebTransport !== "undefined"
  updateRequirement(requirements, "webTransport", {
    status: webTransportSupported ? "supported" : "unsupported",
    detail: webTransportSupported
      ? "WebTransport is available."
      : iosBrowser
        ? "This iPhone browser does not expose WebTransport. Update iOS/Chrome and try Safari if Chrome still rejects the handshake."
        : "This browser does not expose the WebTransport API.",
  })

  const audioContextSupported = typeof AudioContext !== "undefined"
  const audioWorkletSupported =
    audioContextSupported && "audioWorklet" in AudioContext.prototype
  updateRequirement(requirements, "audioWorklet", {
    status: audioWorkletSupported ? "supported" : "unsupported",
    detail: audioWorkletSupported
      ? "AudioWorklet is available."
      : audioContextSupported
        ? "This browser exposes AudioContext, but not AudioWorklet."
        : "This browser does not expose the AudioContext API.",
  })

  const gamepadSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.getGamepads === "function"
  updateRequirement(requirements, "gamepad", {
    status: gamepadSupported ? "supported" : "unsupported",
    detail: gamepadSupported
      ? "Gamepad polling is available."
      : "This browser does not expose navigator.getGamepads().",
  })

  let webCodecsStatus: BrowserRequirementStatus = "unsupported"
  let webCodecsDetail = "This browser does not expose the VideoDecoder API."

  if (typeof VideoDecoder !== "undefined") {
    if (typeof VideoDecoder.isConfigSupported !== "function") {
      webCodecsDetail =
        "This browser exposes VideoDecoder, but not VideoDecoder.isConfigSupported()."
    } else {
      try {
        const result = await VideoDecoder.isConfigSupported({
          codec: "avc1.42C01E",
          codedWidth: 1280,
          codedHeight: 720,
        })

        webCodecsStatus = result.supported ? "supported" : "unsupported"
        webCodecsDetail = result.supported
          ? "WebCodecs is available and reports support for avc1.42C01E decoding."
          : "WebCodecs is available, but avc1.42C01E decoding is not reported as supported."
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        webCodecsDetail = `The avc1.42C01E decoder check failed: ${message}`
      }
    }
  }

  updateRequirement(requirements, "webCodecsAvc", {
    status: webCodecsStatus,
    detail: webCodecsDetail,
  })

  let webCodecsOpusStatus: BrowserRequirementStatus = "unsupported"
  let webCodecsOpusDetail = "This browser does not expose the AudioDecoder API."

  if (typeof AudioDecoder !== "undefined") {
    if (typeof AudioDecoder.isConfigSupported !== "function") {
      webCodecsOpusDetail =
        "This browser exposes AudioDecoder, but not AudioDecoder.isConfigSupported()."
    } else {
      try {
        const result = await AudioDecoder.isConfigSupported({
          codec: "opus",
          sampleRate: 48_000,
          numberOfChannels: 2,
        })

        webCodecsOpusStatus = result.supported ? "supported" : "unsupported"
        webCodecsOpusDetail = result.supported
          ? "WebCodecs is available and reports support for Opus decoding."
          : "WebCodecs is available, but Opus decoding is not reported as supported."
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        webCodecsOpusDetail = `The Opus decoder check failed: ${message}`
      }
    }
  }

  updateRequirement(requirements, "webCodecsOpus", {
    status: webCodecsOpusStatus,
    detail: webCodecsOpusDetail,
  })

  return {
    allSupported: requirements.every(
      (requirement) => requirement.status === "supported",
    ),
    requirements,
  }
}

function updateRequirement(
  requirements: BrowserRequirement[],
  key: BrowserRequirementKey,
  next: Pick<BrowserRequirement, "status" | "detail">,
) {
  const requirement = requirements.find((entry) => entry.key === key)
  if (!requirement) return

  requirement.status = next.status
  requirement.detail = next.detail
}

function isChromiumBrowser() {
  if (typeof navigator === "undefined") {
    return false
  }

  const userAgentData = (
    navigator as Navigator & {
      userAgentData?: {
        brands?: Array<{ brand: string }>
      }
    }
  ).userAgentData
  const brands = userAgentData?.brands ?? []
  if (brands.some(({ brand }) => /Chromium|Chrome|Edge/i.test(brand))) {
    return true
  }

  const userAgent = navigator.userAgent
  return /Chrom(e|ium)|CriOS|Edg|OPR\//i.test(userAgent)
}

function isIOSBrowser() {
  if (typeof navigator === "undefined") {
    return false
  }

  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
}
