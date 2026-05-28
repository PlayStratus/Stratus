"use client"

import { useControllerNavigation } from "@/lib/hooks/useControllerNavigation"

type Props = {
  backHref?: string | null
  enabled?: boolean
  scopeSelector?: string
}

export function ControllerNavigationBoundary({
  backHref,
  enabled = true,
  scopeSelector,
}: Readonly<Props>) {
  useControllerNavigation({ backHref, enabled, scopeSelector })

  return null
}
