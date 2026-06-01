"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

type ControllerNavigationOptions = {
  enabled?: boolean
  backHref?: string | null
  scopeSelector?: string
}

type Direction = "up" | "down" | "left" | "right"

const A_BUTTON_INDEX = 0
const B_BUTTON_INDEX = 1
const DPAD_UP_INDEX = 12
const DPAD_DOWN_INDEX = 13
const DPAD_LEFT_INDEX = 14
const DPAD_RIGHT_INDEX = 15
const STICK_THRESHOLD = 0.55
const REPEAT_DELAY_MS = 280
const REPEAT_INTERVAL_MS = 140
const CONTROLLER_CURRENT_ATTRIBUTE = "data-controller-current"
const FOCUSABLE_SELECTOR = [
  "[data-controller-focus]",
  "a[href]",
  "button",
  "[role='button']",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

type RepeatState = {
  direction: Direction | null
  lastMoveAt: number
  nextRepeatAt: number
}

function getPrimaryGamepad() {
  if (typeof navigator.getGamepads !== "function") {
    return null
  }

  return (
    Array.from(navigator.getGamepads()).find((gamepad) => gamepad?.connected) ??
    null
  )
}

function getButtonPressed(gamepad: Gamepad, index: number) {
  return (gamepad.buttons[index]?.value ?? 0) > 0.5
}

function getDirection(gamepad: Gamepad): Direction | null {
  if (getButtonPressed(gamepad, DPAD_UP_INDEX)) return "up"
  if (getButtonPressed(gamepad, DPAD_DOWN_INDEX)) return "down"
  if (getButtonPressed(gamepad, DPAD_LEFT_INDEX)) return "left"
  if (getButtonPressed(gamepad, DPAD_RIGHT_INDEX)) return "right"

  const horizontal = gamepad.axes[0] ?? 0
  const vertical = gamepad.axes[1] ?? 0

  if (
    Math.abs(horizontal) < STICK_THRESHOLD &&
    Math.abs(vertical) < STICK_THRESHOLD
  ) {
    return null
  }

  if (Math.abs(horizontal) > Math.abs(vertical)) {
    return horizontal > 0 ? "right" : "left"
  }

  return vertical > 0 ? "down" : "up"
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const style = globalThis.getComputedStyle(element)

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  )
}

function isDisabled(element: HTMLElement) {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true"
  )
}

function getScope(scopeSelector?: string) {
  if (!scopeSelector) {
    return document.body
  }

  return document.querySelector<HTMLElement>(scopeSelector) ?? document.body
}

function getFocusableElements(scopeSelector?: string) {
  const scope = getScope(scopeSelector)

  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter((element) => !isDisabled(element) && isVisible(element))
    .filter((element) => element.tabIndex >= 0 || element.matches("a, button"))
}

function getElementCenter(element: HTMLElement) {
  const rect = element.getBoundingClientRect()

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    rect,
  }
}

function getDefaultElement(elements: HTMLElement[]) {
  return (
    elements.find((element) => element.dataset.controllerFocus !== undefined) ??
    elements[0] ??
    null
  )
}

function getClosestElement(
  elements: HTMLElement[],
  currentElement: HTMLElement,
  direction: Direction,
) {
  const current = getElementCenter(currentElement)

  let bestElement: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const element of elements) {
    if (element === currentElement) {
      continue
    }

    const candidate = getElementCenter(element)
    const deltaX = candidate.x - current.x
    const deltaY = candidate.y - current.y
    const isInDirection =
      (direction === "up" && deltaY < -1) ||
      (direction === "down" && deltaY > 1) ||
      (direction === "left" && deltaX < -1) ||
      (direction === "right" && deltaX > 1)

    if (!isInDirection) {
      continue
    }

    const primaryDistance =
      direction === "left" || direction === "right"
        ? Math.abs(deltaX)
        : Math.abs(deltaY)
    const secondaryDistance =
      direction === "left" || direction === "right"
        ? Math.abs(deltaY)
        : Math.abs(deltaX)
    const overlapBias = hasPerpendicularOverlap(
      current.rect,
      candidate.rect,
      direction,
    )
      ? 0
      : 250
    const score = primaryDistance + secondaryDistance * 2 + overlapBias

    if (score < bestScore) {
      bestScore = score
      bestElement = element
    }
  }

  return bestElement
}

function hasPerpendicularOverlap(
  current: DOMRect,
  candidate: DOMRect,
  direction: Direction,
) {
  if (direction === "left" || direction === "right") {
    return candidate.bottom >= current.top && candidate.top <= current.bottom
  }

  return candidate.right >= current.left && candidate.left <= current.right
}

function setControllerFocus(element: HTMLElement | null) {
  document
    .querySelectorAll<HTMLElement>(`[${CONTROLLER_CURRENT_ATTRIBUTE}]`)
    .forEach((currentElement) => {
      currentElement.removeAttribute(CONTROLLER_CURRENT_ATTRIBUTE)
    })

  if (!element) {
    return
  }

  element.setAttribute(CONTROLLER_CURRENT_ATTRIBUTE, "true")
  element.focus({ preventScroll: true })
  element.scrollIntoView({ block: "nearest", inline: "nearest" })
}

function activateElement(element: HTMLElement) {
  element.click()
}

function shouldMove(
  repeatState: RepeatState,
  direction: Direction,
  now: number,
) {
  if (repeatState.direction !== direction) {
    repeatState.direction = direction
    repeatState.lastMoveAt = now
    repeatState.nextRepeatAt = now + REPEAT_DELAY_MS
    return true
  }

  if (now < repeatState.nextRepeatAt) {
    return false
  }

  repeatState.lastMoveAt = now
  repeatState.nextRepeatAt = now + REPEAT_INTERVAL_MS
  return true
}

function resetRepeatState(repeatState: RepeatState) {
  repeatState.direction = null
  repeatState.lastMoveAt = 0
  repeatState.nextRepeatAt = 0
}

export function useControllerNavigation({
  enabled = true,
  backHref,
  scopeSelector,
}: ControllerNavigationOptions) {
  const router = useRouter()
  const previousARef = useRef(false)
  const previousBRef = useRef(false)
  const repeatStateRef = useRef<RepeatState>({
    direction: null,
    lastMoveAt: 0,
    nextRepeatAt: 0,
  })

  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== "function") {
      return
    }

    let rafId = 0
    let disposed = false

    const loop = (now: number) => {
      if (disposed) {
        return
      }

      const gamepad = getPrimaryGamepad()

      if (!gamepad) {
        resetRepeatState(repeatStateRef.current)
        previousARef.current = false
        previousBRef.current = false
        rafId = requestAnimationFrame(loop)
        return
      }

      const elements = getFocusableElements(scopeSelector)
      const focusedElement =
        document.activeElement instanceof HTMLElement &&
        elements.includes(document.activeElement)
          ? document.activeElement
          : null
      const activeElement = focusedElement ?? getDefaultElement(elements)

      const isAPressed = getButtonPressed(gamepad, A_BUTTON_INDEX)
      const isBPressed = getButtonPressed(gamepad, B_BUTTON_INDEX)
      const direction = getDirection(gamepad)

      if (isAPressed && !previousARef.current && activeElement) {
        setControllerFocus(activeElement)
        activateElement(activeElement)
      } else if (isBPressed && !previousBRef.current && backHref) {
        router.push(backHref)
      } else if (direction && activeElement) {
        if (!focusedElement) {
          setControllerFocus(activeElement)
        } else if (shouldMove(repeatStateRef.current, direction, now)) {
          const nextElement = getClosestElement(
            elements,
            activeElement,
            direction,
          )
          setControllerFocus(nextElement ?? activeElement)
        }
      } else {
        resetRepeatState(repeatStateRef.current)
      }

      previousARef.current = isAPressed
      previousBRef.current = isBPressed
      rafId = requestAnimationFrame(loop)
    }

    const clearControllerFocus = () => setControllerFocus(null)

    globalThis.addEventListener("keydown", clearControllerFocus)
    globalThis.addEventListener("pointerdown", clearControllerFocus)
    rafId = requestAnimationFrame(loop)

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      globalThis.removeEventListener("keydown", clearControllerFocus)
      globalThis.removeEventListener("pointerdown", clearControllerFocus)
      setControllerFocus(null)
    }
  }, [backHref, enabled, router, scopeSelector])
}
