"use client"
import { getBackendPath } from "@/lib/backend/getBackendPath"

import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Props = {
  title: string
  wrapperRef: React.RefObject<HTMLDivElement | null>
}

export default function LandingForm({ title, wrapperRef }: Readonly<Props>) {
  const { token } = useAuth()

  const enterFullscreen = async () => {
    const el = wrapperRef.current as any
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

  const handleClick = async () => {
    enterFullscreen()

    const response = await fetch(getBackendPath("/play/session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        game_id: title,
        width: 1280,
        height: 720,
      }),
    })

    if (!response.ok) {
      console.log("Failed to create session:", await response.json())
      exitFullscreen()

      return
    }
  }

  return (
    <Card className='flex items-center justify-center p-8 m-auto'>
      <h1 className='text-2xl font-bold mb-4'>{title}</h1>
      <p className='text-muted-foreground mb-6'>
        This is where the game will be rendered.
      </p>
      <Button onClick={handleClick}>Start Game</Button>
    </Card>
  )
}
