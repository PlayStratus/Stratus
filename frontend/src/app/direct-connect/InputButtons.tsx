import { useEffect, useRef } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

type AxisXValue = -1 | 0 | 1

type InputButtonsProps = {
  onAxisXChange: (value: AxisXValue) => void
}

const LEFT_AXIS_VALUE = -1
const RIGHT_AXIS_VALUE = 1
const NEUTRAL_AXIS_VALUE = 0

export default function InputButtons({
  onAxisXChange,
}: Readonly<InputButtonsProps>) {
  const activeInputsRef = useRef(new Map<string, AxisXValue>())

  const syncDirection = () => {
    const activeValues = Array.from(activeInputsRef.current.values())
    const nextDirection = activeValues.at(-1) ?? NEUTRAL_AXIS_VALUE

    onAxisXChange(nextDirection)
  }

  const activateDirection = (token: string, direction: AxisXValue) => {
    activeInputsRef.current.delete(token)
    activeInputsRef.current.set(token, direction)
    syncDirection()
  }

  const deactivateDirection = (token: string) => {
    if (!activeInputsRef.current.delete(token)) {
      return
    }

    syncDirection()
  }

  useEffect(() => {
    return () => {
      activeInputsRef.current.clear()
      onAxisXChange(NEUTRAL_AXIS_VALUE)
    }
  }, [onAxisXChange])

  return (
    <div className='fixed bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4 z-10'>
      <Button
        type='button'
        size='lg'
        onPointerDown={(event) => {
          if (event.button !== 0) return
          activateDirection(`pointer:left:${event.pointerId}`, LEFT_AXIS_VALUE)
        }}
        onPointerUp={(event) => {
          deactivateDirection(`pointer:left:${event.pointerId}`)
        }}
        onPointerCancel={(event) => {
          deactivateDirection(`pointer:left:${event.pointerId}`)
        }}
        onPointerLeave={(event) => {
          deactivateDirection(`pointer:left:${event.pointerId}`)
        }}
        onKeyDown={(event) => {
          if (event.repeat) return
          if (event.key !== " " && event.key !== "Enter") return

          event.preventDefault()
          activateDirection("key:left", LEFT_AXIS_VALUE)
        }}
        onKeyUp={(event) => {
          if (event.key !== " " && event.key !== "Enter") return

          event.preventDefault()
          deactivateDirection("key:left")
        }}
        onBlur={() => {
          deactivateDirection("key:left")
        }}
        aria-label='Steer left'
      >
        <ArrowLeft />
      </Button>
      <Button
        type='button'
        size='lg'
        onPointerDown={(event) => {
          if (event.button !== 0) return
          activateDirection(
            `pointer:right:${event.pointerId}`,
            RIGHT_AXIS_VALUE,
          )
        }}
        onPointerUp={(event) => {
          deactivateDirection(`pointer:right:${event.pointerId}`)
        }}
        onPointerCancel={(event) => {
          deactivateDirection(`pointer:right:${event.pointerId}`)
        }}
        onPointerLeave={(event) => {
          deactivateDirection(`pointer:right:${event.pointerId}`)
        }}
        onKeyDown={(event) => {
          if (event.repeat) return
          if (event.key !== " " && event.key !== "Enter") return

          event.preventDefault()
          activateDirection("key:right", RIGHT_AXIS_VALUE)
        }}
        onKeyUp={(event) => {
          if (event.key !== " " && event.key !== "Enter") return

          event.preventDefault()
          deactivateDirection("key:right")
        }}
        onBlur={() => {
          deactivateDirection("key:right")
        }}
        aria-label='Steer right'
      >
        <ArrowRight />
      </Button>
    </div>
  )
}
