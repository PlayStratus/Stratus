import { MonitorPlay, Zap, Code, Leaf } from "lucide-react"
import Link from "next/link"

import { CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { HoverCard } from "@/components/ui/hover-card"

const highlights = [
  {
    title: "Compatible",
    description: (
      <>
        Stratus works on any device and supports any Windows- or Linux-native
        game
      </>
    ),
    Icon: MonitorPlay,
  },
  {
    title: "Fast",
    description: (
      <>
        Stratus can stream in 1080p at 60fps with round-trip latencies of as
        little as 40ms
      </>
    ),
    Icon: Zap,
  },
  {
    title: "Open Source",
    description: (
      <>
        The complete source code for Stratus is available on{" "}
        <Link
          href='https://github.com/PlayStratus/Stratus'
          target='_blank'
          rel='noreferrer'
          className='font-medium text-primary underline-offset-4 hover:underline'
        >
          GitHub
        </Link>
      </>
    ),
    Icon: Code,
  },
  {
    title: "Recycled Hardware",
    description: <>The Stratus servers run on recycled crypto-miners</>,
    Icon: Leaf,
  },
]

export default function Highlights() {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
      {highlights.map(({ title, description, Icon }) => (
        <HoverCard key={title} className='text-center'>
          <CardContent className='flex h-full flex-col items-center px-6'>
            <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10'>
              <Icon className='h-6 w-6 text-primary' aria-hidden='true' />
            </div>
            <CardTitle className='mb-2 text-xl font-semibold group-hover:text-primary transition-colors'>
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardContent>
        </HoverCard>
      ))}
    </div>
  )
}
