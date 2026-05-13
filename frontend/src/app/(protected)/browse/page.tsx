import type { Metadata } from "next"
import Link from "next/link"

import { CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { HoverCard } from "@/components/ui/hover-card"

import { getGames } from "@/lib/actions/games"
import { GameType } from "@/lib/types"

export const metadata: Metadata = {
  title: "Browse",
}

export default async function Browse() {
  const games = await getGames()

  const featuredGame = games
    ? games[Math.floor(Math.random() * games.length)]
    : null

  return (
    <>
      <FeaturedGame game={featuredGame} />

      <main className='container mx-auto px-4 py-14 md:px-6 md:py-16'>
        <h2 className='text-3xl font-bold mb-6'>Browse Games</h2>

        <section className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
          {games?.map((game) => (
            <HoverCard
              href={"/browse/" + game.GameID}
              className='h-full cursor-pointer gap-0 overflow-hidden rounded-lg py-0'
              key={game.GameID}
            >
              <div className='relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted'>
                {game.s3?.[0] ? (
                  <img
                    src={game.s3[0]}
                    alt={game.title}
                    className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center text-muted-foreground'>
                    No image
                  </div>
                )}
              </div>

              <CardContent className='flex grow flex-col px-4 py-3'>
                <CardTitle className='mb-1 line-clamp-1 text-lg font-semibold transition-colors group-hover:text-primary'>
                  {game.title}
                </CardTitle>
                <CardDescription className='line-clamp-2'>
                  {game.sDescript}
                </CardDescription>
              </CardContent>
            </HoverCard>
          ))}
        </section>
      </main>
    </>
  )
}

function FeaturedGame({ game }: Readonly<{ game: GameType | null }>) {
  if (!game) {
    return null
  }

  const featuredGenres = game.genres?.slice(0, 3) ?? []
  const description = game.lDescript || game.sDescript

  return (
    <section className='px-4 pt-6 md:px-6 md:pt-8'>
      <Link
        href={`/browse/${game.GameID}`}
        className='group relative isolate block overflow-hidden rounded-4xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/15'
      >
        <img
          src={game.s3[0]}
          alt={`${game.title} featured cover`}
          className='absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-105 group-hover:saturate-125'
        />

        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_35%)]' />
        <div className='absolute inset-0 bg-linear-to-r from-black via-black/80 to-black/20 md:to-transparent' />
        <div className='absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-black/10' />

        <div className='relative mx-auto flex min-h-120 max-w-7xl flex-col justify-between px-6 py-7 text-white md:min-h-136 md:px-10 md:py-10 lg:px-14'>
          <div className='flex items-start justify-between gap-4'>
            <div className='inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/85 backdrop-blur-md'>
              Featured
            </div>
          </div>

          <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end'>
            <div className='max-w-3xl'>
              <div className='mb-4 flex flex-wrap gap-2'>
                {featuredGenres.map((genre) => (
                  <span
                    key={genre}
                    className='rounded-full border border-white/15 bg-black/25 px-3 py-1 text-xs font-medium tracking-[0.16em] text-white/80 uppercase backdrop-blur-sm'
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <h2 className='max-w-2xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl'>
                {game.title}
              </h2>

              <p className='mt-3 text-sm uppercase tracking-[0.28em] text-white/65'>
                By {game.developer}
              </p>

              <p className='mt-5 max-w-2xl text-sm leading-7 text-white/85 md:text-base line-clamp-4'>
                {description}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}
