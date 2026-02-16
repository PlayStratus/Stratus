import { useEffect, useRef } from "react"

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export default function Loading({ canvasRef }: Readonly<Props>) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const lockedScaleRef = useRef<number | null>(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return

    const ctx = canvas.getContext("2d")

    let rafId = 0
    const resizeCanvas = () => {
      const dpr = globalThis.devicePixelRatio || 1
      const nextWidth = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const nextHeight = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== nextWidth) canvas.width = nextWidth
      if (canvas.height !== nextHeight) canvas.height = nextHeight
    }

    const drawCover = () => {
      resizeCanvas()

      if (ctx && video.readyState >= 2) {
        const vw = video.videoWidth
        const vh = video.videoHeight

        const cw = canvas.width
        const ch = canvas.height

        if (vw > 0 && vh > 0 && cw > 0 && ch > 0) {
          if (lockedScaleRef.current === null) {
            // Lock initial scale so future viewport changes crop on both axes.
            lockedScaleRef.current = Math.max(cw / vw, ch / vh)
          }

          const scale = lockedScaleRef.current
          if (!scale) return

          const renderedWidth = vw * scale
          const renderedHeight = vh * scale
          const dx = (cw - renderedWidth) / 2
          const dy = (ch - renderedHeight) / 2

          ctx.clearRect(0, 0, cw, ch)
          ctx.drawImage(
            video,
            0,
            0,
            vw,
            vh,
            dx,
            dy,
            renderedWidth,
            renderedHeight,
          )
        }
      }

      rafId = requestAnimationFrame(drawCover)
    }

    const startDrawing = () => {
      if (rafId !== 0) return
      rafId = requestAnimationFrame(drawCover)
    }

    const onPlay = () => startDrawing()

    video.addEventListener("play", onPlay)
    video.addEventListener("loadeddata", startDrawing)
    video.addEventListener("canplay", startDrawing)
    globalThis.addEventListener("resize", resizeCanvas)

    if (!video.paused && !video.ended) {
      startDrawing()
    } else {
      void video.play().catch(() => {
        // Ignore autoplay rejection and wait for user interaction.
      })
    }

    return () => {
      if (rafId !== 0) cancelAnimationFrame(rafId)
      video.removeEventListener("play", onPlay)
      video.removeEventListener("loadeddata", startDrawing)
      video.removeEventListener("canplay", startDrawing)
      globalThis.removeEventListener("resize", resizeCanvas)
    }
  }, [])

  return (
    <video
      ref={videoRef}
      src='/loading.mp4'
      autoPlay
      muted
      loop
      playsInline
      style={{ display: "none" }}
    />
  )
}
