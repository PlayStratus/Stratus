import Image from "next/image"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { HoverCard } from "@/components/ui/hover-card"

import assaultCube from "@/assets/games/assault-cube.png"
import freeDoom from "@/assets/games/free-doom.png"
import superTuxKart from "@/assets/games/super-tux-kart.png"
import superTux from "@/assets/games/super-tux.png"

const games = [
  {
    title: "SuperTuxKart",
    description:
      "A fun and fast-paced kart racing game featuring open-source mascots.",
    image: superTuxKart,
  },
  {
    title: "SuperTux",
    description: "A classic 2D platformer starring Tux the penguin.",
    image: superTux,
  },
  {
    title: "AssaultCube",
    description: "A lightweight first-person shooter based on the Cube engine.",
    image: assaultCube,
  },
  {
    title: "Freedoom",
    description: "A Doom source port with free and open content.",
    image: freeDoom,
  },
]

export default function FeaturedGames() {
  return (
    <Carousel className='w-full'>
      <CarouselContent className='-ml-4'>
        {(games ?? []).map((game, index) => (
          <CarouselItem
            key={index}
            className='pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4'
          >
            <HoverCard className='h-full gap-0 overflow-hidden rounded-lg py-0'>
              <div className='relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted'>
                <Image
                  src={game.image}
                  alt={game.title}
                  sizes='(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw'
                  className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105'
                />
              </div>
              <CardContent className='flex grow flex-col px-4 py-3'>
                <CardTitle className='mb-1 text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1'>
                  {game.title}
                </CardTitle>
                <CardDescription className='line-clamp-2'>
                  {game.description}
                </CardDescription>
              </CardContent>
            </HoverCard>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className='hidden sm:block'>
        <CarouselPrevious className='-left-4 lg:-left-12' />
        <CarouselNext className='-right-4 lg:-right-12' />
      </div>
    </Carousel>
  )
}
