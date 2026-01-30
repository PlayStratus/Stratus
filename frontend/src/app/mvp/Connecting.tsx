import { LogType } from "./page"

type Props = {
  connectingLog: LogType[]
}

export default function Connecting({ connectingLog }: Readonly<Props>) {
  return (
    <div className='grid place-items-center w-screen h-screen'>
      <div className='text-center'>
        <h1 className='text-3xl font-bold mb-4'>Connecting...</h1>

        <div className='text-left max-h-64 overflow-y-auto border border-gray-700 p-4 rounded'>
          {connectingLog.map((log, index) => (
            <p
              key={index}
              className={`mb-2 ${log.severity === "error" ? "text-red-600" : ""}`}
            >
              {log.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
