import {
  useCallback,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react"

type ComponentType = "TRANSPORT" | "ROUTER" | "VIDEO" | "CONTROL" | "INPUT"

type SeverityType = "info" | "log" | "warn" | "error"

export type LogEntry = {
  id: number
  timestamp: number
  component: ComponentType
  message: string
  severity: SeverityType
}

type LogsContextValue = {
  logs: LogEntry[]
  addLogEvent: (
    component: ComponentType,
    message: string,
    severity?: SeverityType,
  ) => void
}

const LogsContext = createContext<LogsContextValue | null>(null)
const logTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hour12: false,
})

function useLogsState(): LogsContextValue {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef<number>(1)

  const addLogEvent = useCallback(
    (
      component: ComponentType,
      message: string,
      severity: SeverityType = "log",
    ) => {
      const id = logIdRef.current++
      setLogs((prev) => [
        ...prev,
        { id, timestamp: Date.now(), message, severity, component },
      ])

      if (severity === "error") {
        console.error(`[${component}] ${message}`)
      } else if (severity === "warn") {
        console.warn(`[${component}] ${message}`)
      } else if (severity === "log") {
        console.log(`[${component}] ${message}`)
      }
    },
    [],
  )

  return { logs, addLogEvent }
}

export function LogsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const value = useLogsState()
  return createElement(LogsContext.Provider, { value }, children)
}

export function useLogs() {
  const context = useContext(LogsContext)
  if (!context) {
    throw new Error("useLogs must be used within a LogsProvider")
  }

  return context
}

export function dumpLogs(logs: LogEntry[]) {
  const logText = logs
    .map(
      (log) =>
        `[${formatLogTimestamp(log.timestamp)}] [${log.component.padEnd(4).toUpperCase()}] [${log.severity.padEnd(3).toUpperCase()}] ${log.message}`,
    )
    .join("\n")

  const blob = new Blob([logText], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `logs_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function formatLogTimestamp(timestamp: number) {
  return logTimeFormatter.format(new Date(timestamp))
}
