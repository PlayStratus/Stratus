import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

import b250 from "@/assets/demo/b250.jpg"
import browser from "@/assets/demo/browser.jpg"
import endToEnd from "@/assets/demo/end-to-end.jpg"
import liveGaming from "@/assets/demo/live-gaming.jpg"

import { ExpandableImage } from "../ui/expandable-image"

const images = [browser, liveGaming, b250, endToEnd]

export default function Demo() {
  return (
    <Carousel className='w-full'>
      <CarouselContent>
        {images.map((src, index) => (
          <CarouselItem key={index} className='px-4 md:px-6 lg:px-8'>
            <div className='overflow-hidden rounded-xl border border-border shadow-lg p-1 bg-card'>
              <ExpandableImage
                src={src}
                alt={`Demo image ${index + 1}`}
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
