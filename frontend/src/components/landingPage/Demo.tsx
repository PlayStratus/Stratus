import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

import bc250 from "@/assets/demo/bc250.jpg"
import browser from "@/assets/demo/browser.jpg"
import endToEnd from "@/assets/demo/end-to-end.jpg"
import liveGaming from "@/assets/demo/live-gaming.jpg"

import { ExpandableImage } from "../ui/expandable-image"

const images = [
  {
    src: browser,
    alt: 'Streaming SuperTuxKart on Stratus',
  }, {
    src: liveGaming,
    alt: 'Testing Stratus on the BC-250 streaming cluster',
  }, {
    src: bc250,
    alt: 'The BC-250 cluster used for streaming',
  }, {
    src: endToEnd,
    alt: 'The Stratus architecture and stream session lifecycle',
  }
]

export default function Demo() {
  return (
    <Carousel className='w-full'>
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index} className='px-4 md:px-6 lg:px-8'>
            <div className='overflow-hidden rounded-xl border border-border shadow-lg p-1 bg-card'>
              <ExpandableImage
                src={image.src}
                alt={image.alt}
                width={1200}
                height={800}
                className='w-full aspect-video flex items-center justify-center rounded-lg overflow-hidden bg-black/5'
                imageClassName='w-full h-full object-cover object-center'
              />
            </div>
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
