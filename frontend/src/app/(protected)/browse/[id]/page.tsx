import { ArrowLeft, Play } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { GameGallery } from "@/components/game/game-gallery"

import { getGameById } from "@/lib/actions/games"
import { isStaticExport } from "@/lib/static-export"
import { cn } from "@/lib/utils"

type Props = {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return isStaticExport ? [{ id: "__static-export-placeholder__" }] : []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (isStaticExport) {
    return {
      title: "Game",
    }
  }

  const { id } = await params
  const game = await getGameById(id)

  return {
    title: game?.title ?? "Game Not Found",
  }
}

export default async function Service({ params }: Props) {
  if (isStaticExport) {
    return null
  }

  const { id } = await params

  const game = await getGameById(id)
  if (!game) {
    return (
      <main className='container mx-auto flex flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8'>
        <Link
          href='/browse'
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          <ArrowLeft />
          Back to Browse
        </Link>

        <div className='mt-12 max-w-xl'>
          <p className='text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground'>
            Game not found
          </p>
          <h1 className='mt-3 text-3xl font-bold tracking-tight sm:text-4xl'>
            This game is no longer available.
          </h1>
        </div>
      </main>
    )
  }

  const description = game.lDescript || game.sDescript

  return (
    <main className='container mx-auto flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12'>
      <Link
        href='/browse'
        className={cn(
          buttonVariants({ variant: "outline" }),
          "mb-6 w-fit sm:mb-8",
        )}
      >
        <ArrowLeft />
        Back to Browse
      </Link>

      <div className='grid gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-start lg:gap-12'>
        <section className='min-w-0 overflow-hidden'>
          <GameGallery images={game.s3} />
        </section>

        <section className='min-w-0 rounded-lg border bg-card p-5 shadow-sm sm:p-6 lg:p-8'>
          <div className='space-y-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground'>
              {game.developer}
            </p>
            <h1 className='wrap-break-words text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl'>
              {game.title}
            </h1>
          </div>

          <div className='mt-5 flex flex-wrap gap-2'>
            {game.genres.map((genre) => (
              <span
                key={genre}
                className='rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground sm:text-sm'
              >
                {genre}
              </span>
            ))}
          </div>

          <div className='mt-7 border-t pt-6'>
            <h2 className='text-base font-semibold sm:text-lg'>About</h2>
            <p className='mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base'>
              {description}
            </p>
          </div>

          <Link
            href={"/play/" + game.GameID}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "mt-7 h-12 w-full text-base font-semibold sm:h-11 sm:w-fit sm:px-8",
            )}
          >
            <Play />
            Play Now
          </Link>
        </section>
      </div>
    </main>
  )
}
