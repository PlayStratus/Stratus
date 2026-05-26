"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import NavClient from "@/components/Nav/NavClient"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { dumpLogs, LogsProvider, useLogs } from "@/lib/transport/hooks/logs"
import { useTransport } from "@/lib/transport/hooks/transport"
import { useStreamRouter } from "@/lib/transport/hooks/streamRouter"
import { useVideoStream } from "@/lib/transport/hooks/videoStream"
import { useAudioStream } from "@/lib/transport/hooks/audioStream"
import { useControlStream } from "@/lib/transport/hooks/controlStream"
import { useInputStream } from "@/lib/transport/hooks/inputStream"

import Loading from "./Loading"
import InputButtons from "./InputButtons"

import { StatusType } from "@/lib/transport/types"

const DEFAULT_URL = "localhost:4433"

type MVPPageProps = {
  url: string
  tlsCert: string
}

type MVPPageComponentProps = MVPPageProps & {
  onConnectionError: (errorMessage: string) => void
}

function MVPPage({
  url,
  tlsCert,
  onConnectionError,
}: Readonly<MVPPageComponentProps>) {
  const [status, setStatus] = useState<StatusType>("LOADING")
  const [averageRenderTimeMs, setAverageRenderTimeMs] = useState(0)
  const [averageAudioRenderTimeMs, setAverageAudioRenderTimeMs] = useState(0)
  const [fps, setFps] = useState(0)

  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasStartedRef = useRef(false)
  const hasRedirectedRef = useRef(false)

  const { logs, addLogEvent } = useLogs()

  const { handleConnecting } = useTransport((errorMessage: string) => {
    addLogEvent("TRANSPORT", errorMessage, "error")

    if (hasRedirectedRef.current) {
      return
    }

    hasRedirectedRef.current = true
    onConnectionError(errorMessage)

    const params = new URLSearchParams({
      url,
      tls_cert: tlsCert,
      error: errorMessage,
    })

    router.replace(`/direct-connect?${params.toString()}`)
  })
  const { handleStream } = useStreamRouter()
  const { handleControlStream } = useControlStream()
  const { handleVideoStreams } = useVideoStream(
    canvasRef,
    setStatus,
    setAverageRenderTimeMs,
    setFps,
  )
  const { handleAudioStreams } = useAudioStream(setAverageAudioRenderTimeMs)
  const { handleInputStream, setManualButton } = useInputStream()

  useEffect(() => {
    if (hasStartedRef.current) {
      return
    }
    hasStartedRef.current = true

    const handleMount = async () => {
      const transport = await handleConnecting(url, tlsCert)
      if (!transport) return

      await handleStream(transport, {
        handleControlStream,
        handleVideoStreams,
        handleAudioStreams,
        handleInputStream,
      })
    }

    void handleMount()
  }, [
    handleConnecting,
    handleControlStream,
    handleStream,
    handleAudioStreams,
    handleInputStream,
    handleVideoStreams,
    onConnectionError,
    tlsCert,
    url,
  ])

  useEffect(() => {
    ;(globalThis as any).dumpLogs = () => dumpLogs(logs)
  }, [logs])

  const shouldShowLoading = status === "LOADING"

  return (
    <>
      <canvas
        ref={canvasRef}
        className='h-screen w-screen bg-black'
        data-average-render-time-ms={averageRenderTimeMs}
        data-average-audio-render-time-ms={averageAudioRenderTimeMs}
        data-fps={fps}
      />

      <div className='fixed right-3 top-3 z-20 rounded bg-black/45 px-3 py-2 font-mono text-xs text-white/80'>
        <div>FPS: {fps.toFixed(1)}</div>
        <div>Avg video render: {averageRenderTimeMs.toFixed(1)}ms</div>
        <div>Avg audio render: {averageAudioRenderTimeMs.toFixed(1)}ms</div>
      </div>

      <InputButtons onButtonChange={setManualButton} />

      {shouldShowLoading && <Loading />}
    </>
  )
}

function DirectConnectForm() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [tlsCert, setTlsCert] = useState("")
  const [error, setError] = useState("")
  const [connection, setConnection] = useState<MVPPageProps | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextUrl = params.get("url")?.trim() || DEFAULT_URL
    const nextTlsCert = params.get("tls_cert")?.trim() || ""
    const nextError = params.get("error")?.trim() || ""

    setUrl(nextUrl)
    setTlsCert(nextTlsCert)
    setError(nextError)

    if (nextUrl && nextTlsCert && !nextError) {
      setConnection({ url: nextUrl, tlsCert: nextTlsCert })
    }
  }, [])

  if (connection) {
    return (
      <MVPPage
        url={connection.url}
        tlsCert={connection.tlsCert}
        onConnectionError={(errorMessage) => {
          setError(errorMessage)
          setConnection(null)
        }}
      />
    )
  }

  return (
    <>
      <NavClient games={[]} hideSearchBar />

      <main className='flex flex-1 items-center bg-background px-4 py-12 md:py-16'>
        <section className='container mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(360px,520px)]'>
          <div className='max-w-2xl space-y-5'>
            <p className='text-sm font-semibold uppercase tracking-widest text-muted-foreground'>
              Direct Connect
            </p>

            <h1 className='text-4xl font-bold tracking-tight text-foreground md:text-5xl'>
              Connect to a Stratus streaming server
            </h1>

            <p className='text-lg leading-8 text-muted-foreground'>
              Use a host address and TLS fingerprint to manually connect to a
              session on a streaming server. You can run the Stratus streaming
              server locally by cloning the{" "}
              <a
                href='https://github.com/PlayStratus/Stratus'
                target='_blank'
                rel='noreferrer'
                className='font-medium text-primary underline underline-offset-4'
              >
                GitHub repository
              </a>{" "}
              and following the instructions in{" "}
              <a
                href='https://github.com/PlayStratus/Stratus/blob/main/stratusd/README.md#development-setup'
                target='_blank'
                rel='noreferrer'
                className='font-medium text-primary underline underline-offset-4'
              >
                stratusd/README.md
              </a>
              .
            </p>
          </div>

          <Card className='border-border/80 bg-card/80 shadow-xl shadow-black/20 backdrop-blur'>
            <CardHeader className='space-y-2'>
              <CardTitle className='text-2xl font-semibold tracking-tight'>
                Connection Details
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form action='/direct-connect' method='GET' className='space-y-6'>
                {error ? (
                  <Alert variant='destructive'>
                    <AlertTitle>Connection error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className='space-y-2'>
                  <Label htmlFor='url'>URL</Label>
                  <Input
                    id='url'
                    name='url'
                    type='text'
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    required
                    spellCheck={false}
                    autoCapitalize='none'
                    autoCorrect='off'
                    placeholder='localhost:4433'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tls-cert'>TLS Fingerprint</Label>
                  <textarea
                    id='tls-cert'
                    name='tls_cert'
                    value={tlsCert}
                    onChange={(event) => setTlsCert(event.target.value)}
                    required
                    spellCheck={false}
                    className='min-h-40 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
                    placeholder='"Generated TLS certificate: ..."'
                  />
                </div>

                <Button type='submit' size='lg' className='w-full'>
                  Open Client
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  )
}

export default function ClientPage() {
  return (
    <LogsProvider>
      <DirectConnectForm />
    </LogsProvider>
  )
}
