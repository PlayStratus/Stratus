import Link from "next/link"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = React.ComponentProps<"div"> & {
  "data-controller-focus"?: string
  href?: string
}

export function HoverCard({
  className,
  href,
  "data-controller-focus": controllerFocus,
  ...props
}: Readonly<Props>) {
  const card = (
    <Card
      className={cn(
        "group relative transition-all hover:-translate-y-1.5 shadow-md shadow-blue-400/20 hover:shadow-xl hover:shadow-blue-400/30 bg-card border-border",
        className,
      )}
      {...props}
    />
  )

  if (href) {
    return (
      <Link
        href={href}
        className='block h-full cursor-pointer'
        data-controller-surface='hover-card'
        data-controller-focus={controllerFocus}
      >
        {card}
      </Link>
    )
  }

  return card
}
