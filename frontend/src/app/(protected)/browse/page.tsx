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
                className='md:basis-1/2 lg:basis-1/3 aspect-square'
              >
                <Link href={"/browse/" + game.GameID}>
                  <Card className='transition-all hover:shadow-lg hover:border-primary/50'>
                    <CardContent className='p-2'>
                      <div className='aspect-video bg-muted flex items-center justify-center'>
                        <img src={game.s3[0]} alt="Game image" />
                      </div>

                      {/* Game info */}
                      <div className='p-4'>
                        <h3 className='font-semibold text-lg mb-2'>
                          {game.title}
                        </h3>
                        <p className='text-sm text-muted-foreground line-clamp-3'>
                          {game.sDescript}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
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


