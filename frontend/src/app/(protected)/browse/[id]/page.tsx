import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { GameGallery } from "@/components/game/game-gallery"

import { getGameById } from "@/lib/actions/games"

type Props = {
  params: Promise<{ id: string }>
}

export default async function Service({ params }: Props) {
  const { id } = await params

  const game = await getGameById(id)
  if(!game){
    return <div>Game not found</div>;
  }

  return (
    <main className='flex flex-col p-24 container mx-auto'>
      <Link
        href='/browse'
        className={buttonVariants({ variant: "outline" }) + " w-fit mb-8"}
      >
        ← Back to Browse
      </Link>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-12'>
        <div className='max-w-full overflow-hidden'>
          <GameGallery images={game.s3} />
        </div>

        <div className='space-y-6'>
          <div>
            <h1 className='text-4xl font-bold mb-2'>{game.title}</h1>
            <p className='text-muted-foreground'>Developer: {game.developer}</p>
          </div>

          <div className='flex flex-wrap gap-2'>
            {game.genres.map((genre) => (
              <span
                key={genre}
                className='px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm'
              >
                {genre}
              </span>
            ))}
          </div>

          <div>
            <h2 className='text-lg font-semibold mb-2'>About</h2>
            <p className='text-muted-foreground leading-relaxed'>
              {game.lDescript}
            </p>

            <Link
              href={"/play/" + game.GameID}
              className={
                buttonVariants({ variant: "default", size: "lg" }) +
                " mt-6 w-full text-lg py-6"
              }
            >
              Play Now
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
