import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background to-muted/20'>
      <div className='flex flex-col items-center justify-center space-y-8 px-4 py-16 text-center max-w-5xl'>
        <h1 className='text-6xl md:text-7xl font-extrabold'>Stratus</h1>

        <p className='text-base md:text-lg text-foreground/80 max-w-3xl leading-relaxed'>
          We are going to host a server consisting of several GPU’s that will
          run and host games for users to connect to. These users will have game
          data streamed to their devices, while their inputs will be returned to
          the server for the game to carry out.
        </p>

        <div className='flex flex-col sm:flex-row gap-4 mt-8'>
          <Link
            href='/login'
            className={buttonVariants({
              size: "lg",
              className: "text-lg px-8 py-6",
            })}
          >
            Get Started
          </Link>

          <Link
            href='/about'
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "text-lg px-8 py-6",
            })}
          >
            Learn More
          </Link>
        </div>
      </div>
    </main>
  )
}
