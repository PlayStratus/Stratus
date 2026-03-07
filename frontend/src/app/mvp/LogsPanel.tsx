import { Alert, AlertDescription } from "@/components/ui/alert"

import { type LogEntry } from "./logs"

type Props = {
  logs: LogEntry[]
}

export default function Logs({ logs }: Readonly<Props>) {
  return (
    <div className='pointer-events-none fixed right-4 bottom-4 z-50 flex max-h-[60vh] w-[min(28rem,90vw)] flex-col gap-2 overflow-hidden'>
      {logs.map((log) => (
        <Alert
          key={log.id}
          variant={log.severity === "error" ? "destructive" : "default"}
          className='bg-white/95 shadow-md'
        >
          <AlertDescription>{log.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
