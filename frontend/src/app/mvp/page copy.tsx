"use client"

import { Button } from "@/components/ui/button"
import React, { useEffect, useRef, useState } from "react"

interface CodecSupport {
  videoDecoder: boolean
  audioDecoder: boolean
  supportedVideoCodecs: string[]
  supportedAudioCodecs: string[]
}

export default function FullscreenBox() {
  const containerRef: React.Ref<HTMLDivElement> = useRef(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
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

    checkCodecSupport()
  }, [])

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
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

  const enterFullscreen = async () => {
    const el = containerRef.current as any
    if (!el) return

    if (el.requestFullscreen) {
      await el.requestFullscreen()
    }
  }

  const exitFullscreen = async () => {
    if (document.exitFullscreen) {
      await document.exitFullscreen()
    }
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) exitFullscreen()
    else enterFullscreen()
  }

  return (
    <div
      ref={containerRef}
      className='bg-gray-900 grid place-items-center relative w-screen h-screen'
    >
      <div className='text-white space-y-4 p-8 max-w-2xl'>
        <h2 className='text-2xl font-bold mb-4'>Video</h2>

        <Button
          onClick={toggleFullscreen}
          className='absolute bottom-4 right-4'
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </Button>
      </div>
    </div>
  )
}
