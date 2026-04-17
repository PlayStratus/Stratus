"use client";

import { useState, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export function GameGallery({ images }: { images: string[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }
    
    // When the carousel scrolls (e.g. by dragging), update selected if it makes sense,
    // but the snap points might not equal the exact index if multiple items are visible.
    // However, since we want arrows to select different images, we listen to 'select'.
    api.on("select", () => {
      // Find the currently active slide index (not snap point, but slide)
      // Embla's selectedScrollSnap is the snap index, but we can just use the first slide in view
      const selectedSlide = api.selectedScrollSnap();
      setSelectedIndex(selectedSlide);
    });
  }, [api]);

  const handlePrevious = () => {
    const prev = selectedIndex === 0 ? images.length - 1 : selectedIndex - 1;
    setSelectedIndex(prev);
    api?.scrollTo(prev);
  }

  const handleNext = () => {
    const next = selectedIndex === images.length - 1 ? 0 : selectedIndex + 1;
    setSelectedIndex(next);
    api?.scrollTo(next);
  }

  return (
    <div className='space-y-4'>
      {/* Main Display Image */}
      <div className='relative aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden group'>
        <img 
          src={images[selectedIndex]} 
          alt="Game main image" 
          className="w-full h-full object-cover" 
        />
        <button 
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-10 w-10 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span className="sr-only">Previous image</span>
        </button>
        <button 
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-10 w-10 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          <span className="sr-only">Next image</span>
        </button>
      </div>

      {/* Carousel */}
      <Carousel className='w-full' setApi={setApi}>
        <CarouselContent>
          {images.map((imgSrc, index) => (
            <CarouselItem key={imgSrc + index} className='basis-1/4'>
              <div 
                className={`aspect-video bg-muted rounded flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors overflow-hidden border-2 ${
                  index === selectedIndex ? "border-primary" : "border-transparent"
                }`}
                onClick={() => {
                  setSelectedIndex(index);
                  api?.scrollTo(index);
                }}
              >
                <img src={imgSrc} alt={`Game thumbnail ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="absolute top-1/2 -left-12 -translate-y-1/2">
          <button 
            type="button" 
            onClick={handlePrevious} 
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 w-8 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            <span className="sr-only">Previous image</span>
          </button>
        </div>
        <div className="absolute top-1/2 -right-12 -translate-y-1/2">
          <button 
            type="button" 
            onClick={handleNext} 
            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 w-8 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <span className="sr-only">Next image</span>
          </button>
        </div>
      </Carousel>
    </div>
  );
}
