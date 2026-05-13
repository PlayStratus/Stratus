"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Button } from "@/components/ui/button"

import { cn } from "@/lib/utils"

type Props = {
  images: string[]
}

export function GameGallery({ images }: Readonly<Props>) {
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const hasMultipleImages = images.length > 1

  useEffect(() => {
    if (!api) {
      return
    }

    const updateSelected = () => {
      setSelectedIndex(api.selectedScrollSnap())
    }

    updateSelected()
    api.on("select", updateSelected)

    return () => {
      api.off("select", updateSelected)
    }
  }, [api])

  const handlePrevious = () => {
    if (!hasMultipleImages) {
      return
    }

    const prev = selectedIndex === 0 ? images.length - 1 : selectedIndex - 1
    setSelectedIndex(prev)
    api?.scrollTo(prev)
  }

  const handleNext = () => {
    if (!hasMultipleImages) {
      return
    }

    const next = selectedIndex === images.length - 1 ? 0 : selectedIndex + 1
    setSelectedIndex(next)
    api?.scrollTo(next)
  }

  if (!images.length) {
    return (
      <div className='flex aspect-video w-full items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground'>
        No images available
      </div>
    )
  }

  return (
    <div className='min-w-0 space-y-3 sm:space-y-4'>
      <div className='group relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted shadow-sm'>
        <img
          src={images[selectedIndex]}
          alt='Selected game screenshot'
          className='h-full w-full object-cover'
        />

        {hasMultipleImages && (
          <>
            <Button
              type='button'
              variant='secondary'
              size='icon'
              onClick={handlePrevious}
              className='absolute left-2 top-1/2 size-9 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm hover:bg-black/75 sm:left-4 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100'
            >
              <ChevronLeft />
              <span className='sr-only'>Previous image</span>
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='icon'
              onClick={handleNext}
              className='absolute right-2 top-1/2 size-9 -translate-y-1/2 rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm hover:bg-black/75 sm:right-4 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100'
            >
              <ChevronRight />
              <span className='sr-only'>Next image</span>
            </Button>
          </>
        )}
      </div>

      <Carousel className='w-full' opts={{ align: "start" }} setApi={setApi}>
        <CarouselContent>
          {images.map((imgSrc, index) => (
            <CarouselItem
              key={imgSrc + index}
              className='basis-1/3 sm:basis-1/4'
            >
              <button
                type='button'
                className={cn(
                  "flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 bg-muted transition hover:bg-muted/80",
                  index === selectedIndex
                    ? "border-primary"
                    : "border-transparent",
                )}
                onClick={() => {
                  setSelectedIndex(index)
                  api?.scrollTo(index)
                }}
              >
                <img
                  src={imgSrc}
                  alt={`Game thumbnail ${index + 1}`}
                  className='w-full h-full object-cover'
                />
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  )
}
