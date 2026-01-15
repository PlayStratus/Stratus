"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export default function FullScreenButton({ containerRef }: Readonly<Props>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

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

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  return (
    <Button onClick={toggleFullscreen} className='absolute bottom-4 right-4'>
      {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
    </Button>
  )
}
