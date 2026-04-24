export type BrowserRequirementKey = "webTransport" | "webCodecsAvc" | "gamepad"

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

  const webTransportSupported = typeof WebTransport !== "undefined"
  updateRequirement(requirements, "webTransport", {
    status: webTransportSupported ? "supported" : "unsupported",
    detail: webTransportSupported
      ? "WebTransport is available."
      : "This browser does not expose the WebTransport API.",
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
