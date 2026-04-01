"use client"

import { useEffect, useRef, useState } from "react"

import LandingForm from "./LandingForm"

type Props = {
  title: string
}

export default function Client({ title }: Readonly<Props>) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const onChange = () => {
      setIsPlaying(document.fullscreenElement === wrapperRef.current)
    }

    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    if (!isPlaying && document.fullscreenElement === wrapperRef.current) {
      void document.exitFullscreen?.()
    }
  }, [isPlaying])

  return (
    <div className='flex-1 flex' ref={wrapperRef}>
      {isPlaying ? (
        <canvas className='w-full h-full bg-black' />
      ) : (
        <LandingForm title={title} wrapperRef={wrapperRef} />
      )}
    </div>
  )
}
