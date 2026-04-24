import { Card, CardContent } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

import { getGames } from "@/lib/actions/games"
import Link from "next/link"

export default async function Browse() {
  const games = await getGames()
  const shuffledGames = [...(games ?? [])].sort(() => Math.random() - 0.5)

  return (
    <>
      <div className='h-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-24 bg-accent/50'>
        <h1 className='text-4xl font-bold mb-8'>Featured Game</h1>
      </div>

      <main className='container mx-auto py-16'>
        <h2 className='text-3xl font-bold mb-6'>Browse Games</h2>

        <Carousel
          opts={{
            align: "start",
          }}
          className='mx-15'
        >
          <CarouselContent>
            {shuffledGames.map((game, index) => (
              <CarouselItem
                key={index}
                className='md:basis-1/2 lg:basis-1/3 pl-4'
              >
                <Link href={"/browse/" + game.GameID}>
                  <div className="group flex flex-col h-full hover:-translate-y-1 transition-all cursor-pointer rounded-lg shadow-md shadow-blue-400/30 hover:shadow-xl hover:shadow-blue-400/40">
                    <div className="w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-muted relative">
                      {game.s3 && game.s3[0] ? (
                        <img src={game.s3[0]} alt={game.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
                      )}
                    </div>
                    
                    {/* Game info */}
                    <div className="bg-card text-card-foreground px-4 py-3 rounded-b-lg border border-t-0 border-border flex flex-col flex-grow">
                      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
                        {game.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {game.sDescript}
                      </p>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </main>
    </>
  )
}


