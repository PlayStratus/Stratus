import {
  useCallback,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

export type LogEntry = {
  id: number
  message: string
  severity: "info" | "error"
}

type LogsContextValue = {
  logs: LogEntry[]
  addLogEvent: (message: string, severity?: "info" | "error") => void
}

const LogsContext = createContext<LogsContextValue | null>(null)

function useLogsState(): LogsContextValue {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef<number>(1)
  const logTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  const addLogEvent = useCallback(
    (message: string, severity: "info" | "error" = "info") => {
      const id = logIdRef.current++
      setLogs((prev) => [...prev, { id, message, severity }])

      if (severity === "error") {
        console.error(`Log Error: ${message}`)
      }

      const timeoutId = setTimeout(() => {
        setLogs((prev) => prev.filter((log) => log.id !== id))
        logTimeoutsRef.current.delete(id)
      }, 3000)

      logTimeoutsRef.current.set(id, timeoutId)
    },
    [],
  )

  useEffect(
    () => () => {
      logTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      logTimeoutsRef.current.clear()
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
