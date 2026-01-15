"use client"

import { Button } from "@/components/ui/button"
import React, { useEffect, useRef, useState } from "react"
import FullScreenButton from "./FullScreenButton"

interface CodecSupport {
  videoDecoder: boolean
  audioDecoder: boolean
  supportedVideoCodecs: string[]
  supportedAudioCodecs: string[]
}

type Props = {
  transport: WebTransport
  datagramWriter: WritableStreamDefaultWriter<Uint8Array>
  logs: string[]
  setLogs: React.Dispatch<React.SetStateAction<string[]>>
}

export default function Play({
  transport,
  datagramWriter,
  logs,
  setLogs,
}: Readonly<Props>) {
  const containerRef: React.Ref<HTMLDivElement> = useRef(null)
  const [rawData, setRawData] = useState("")
  const [sendType, setSendType] = useState<"datagram" | "unidi" | "bidi">(
    "datagram"
  )

  const handleSend = async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode(rawData)

    if (!transport) {
      setLogs((prevLogs) => [...prevLogs, "Transport not connected."])
      return
    }

    try {
      if (sendType === "datagram") {
        if (!datagramWriter) {
          setLogs((prevLogs) => [...prevLogs, "Datagram writer not available."])
          return
        }
        await datagramWriter.write(data)
        setLogs((prevLogs) => [...prevLogs, `Sent datagram: ${rawData}`])
      } else if (sendType === "unidi") {
        const stream = await transport.createUnidirectionalStream()
        const writer = stream.getWriter()
        await writer.write(data)
        await writer.close()
        setLogs((prevLogs) => [
          ...prevLogs,
          `Sent unidirectional stream: ${rawData}`,
        ])
      } else if (sendType === "bidi") {
        const stream = await transport.createBidirectionalStream()
        const writer = stream.writable.getWriter()
        await writer.write(data)
        await writer.close()
        setLogs((prevLogs) => [
          ...prevLogs,
          `Sent bidirectional stream: ${rawData}`,
        ])
      }
    } catch (e) {
      setLogs((prevLogs) => [...prevLogs, `Error sending data: ${e}`])
    }
  }

  useEffect(() => {
    checkCodecSupport()

    const element = containerRef.current
    if (!element) return

    const resizeObserver = new ResizeObserver(() => {
      const currentWidth = element.clientWidth
      const currentHeight = element.clientHeight

      console.log(`Width: ${currentWidth}, Height: ${currentHeight}`)
    })

    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className='bg-white grid place-items-center relative w-screen h-screen'
    >
      <div className='w-72 flex flex-col items-center gap-4 border p-4'>
        <h1>Send data</h1>

        <textarea
          value={rawData}
          onChange={(e) => setRawData(e.target.value)}
          className='border w-full'
        />

        <select
          value={sendType}
          onChange={(e) =>
            setSendType(e.target.value as "datagram" | "unidi" | "bidi")
          }
          className='border w-full'
        >
          <option value='datagram'>Datagram</option>
          <option value='unidi'>Unidirectional Stream</option>
          <option value='bidi'>Bidirectional Stream</option>
        </select>

        <Button className='w-full' onClick={handleSend}>
          Send
        </Button>

        <div className='text-left max-h-64 overflow-y-auto border w-full p-4 rounded'>
          {logs.map((log, index) => (
            <p key={index} className='mb-2'>
              {log}
            </p>
          ))}
        </div>
      </div>

      <FullScreenButton containerRef={containerRef} />
    </div>
  )
}

const checkCodecSupport = async () => {
  const videoCodecsToTest = [
    "vp8",
    "vp09.00.10.08",
    "avc1.42E01E",
    "avc1.64001F",
    "hev1.1.6.L93.B0",
    "av01.0.05M.08",
  ]

  const audioCodecsToTest = [
    "opus",
    "mp4a.40.2",
    "mp4a.40.5",
    "mp4a.67",
    "flac",
    "vorbis",
  ]

  const support: CodecSupport = {
    videoDecoder: typeof VideoDecoder !== "undefined",
    audioDecoder: typeof AudioDecoder !== "undefined",
    supportedVideoCodecs: [],
    supportedAudioCodecs: [],
  }

  if (support.videoDecoder && VideoDecoder.isConfigSupported) {
    for (const codec of videoCodecsToTest) {
      try {
        const config = {
          codec,
          codedWidth: 1920,
          codedHeight: 1080,
        }
        const result = await VideoDecoder.isConfigSupported(config)
        if (result.supported) {
          support.supportedVideoCodecs.push(codec)
        }
      } catch (e) {
        console.error(`Error checking video codec ${codec}:`, e)
      }
    }
  }

  if (support.audioDecoder && AudioDecoder.isConfigSupported) {
    for (const codec of audioCodecsToTest) {
      try {
        const config = {
          codec,
          sampleRate: 48000,
          numberOfChannels: 2,
        }
        const result = await AudioDecoder.isConfigSupported(config)
        if (result.supported) {
          support.supportedAudioCodecs.push(codec)
        }
      } catch (e) {
        console.error(`Error checking audio codec ${codec}:`, e)
      }
    }
  }

  console.log("VideoDecoder available:", support.videoDecoder)
  console.log("AudioDecoder available:", support.audioDecoder)
  console.log("Supported video codecs:", support.supportedVideoCodecs)
  console.log("Supported audio codecs:", support.supportedAudioCodecs)
}
