import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

import architecture from "@/assets/demo/architecture-overview.png"
import browser from "@/assets/demo/browser.jpg"
import bc_250_on from "@/assets/demo/bc-250-on.jpg"
import bc_250_off from "@/assets/demo/bc-250-off.jpg"

import { ExpandableImage } from "../ui/expandable-image"

const assets = [
  {
    src: browser,
    alt: 'Streaming SuperTuxKart on Stratus',
    image: true
  }, {
    src: '/demo.mkv',
    alt: 'Starting a Stratus streaming session',
    image: false
  }, {
    src: bc_250_on,
    alt: 'The Stratus streaming servers',
    image: true
  }, {
    src: bc_250_off,
    alt: 'The Stratus streaming cluster with one BC-250 node pulled out',
    image: true
  }
]

export default function Demo() {
  return (
    <Carousel className='w-full'>
      <CarouselContent>
        {assets.map((asset, index) => (
          <CarouselItem key={index} className='px-4 md:px-6 lg:px-8'>
            <div className='overflow-hidden rounded-xl border border-border shadow-lg p-1 bg-card'>
              {asset.image ? <ExpandableImage
                src={asset.src}
                alt={asset.alt}
                width={1200}
                height={800}
                sizes='(min-width: 1280px) 1120px, (min-width: 768px) calc(100vw - 7rem), calc(100vw - 2rem)'
                className='w-full aspect-video flex items-center justify-center rounded-lg overflow-hidden bg-black/5'
                imageClassName='w-full h-full object-cover object-center'
              /> : <video
                src={asset.src as string}
                autoPlay muted playsInline
                loop
                controls
                width={1200}
                height={800}
                className='w-full aspect-video object-cover object-center transition-transform group-hover:scale-[1.02]'
              /> }
            </div>
            <p className='text-center italic mt-2'>
              {asset.alt}
            </p>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className='hidden sm:block'>
        <CarouselPrevious className='-left-12' />
        <CarouselNext className='-right-12' />
      </div>
    </Carousel>
  )
}
