"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface ExpandableImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  imageClassName?: string;
}

export function ExpandableImage({ src, alt, width, height, className, imageClassName }: ExpandableImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className={cn("cursor-pointer overflow-hidden group", className)} 
        onClick={() => setIsOpen(true)}
      >
        <Image 
          src={src} 
          alt={alt} 
          width={width} 
          height={height} 
          className={cn("w-full h-auto object-contain transition-transform group-hover:scale-[1.02]", imageClassName)} 
        />
      </div>
      
      {isOpen && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setIsOpen(false)}
        >
          <button 
            type="button"
            className="absolute top-4 right-4 md:top-8 md:right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[60]"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <X size={32} />
            <span className="sr-only">Close</span>
          </button>
          
          <div 
            className="relative w-full h-full flex items-center justify-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-7xl h-full max-h-[90vh]">
              <Image 
                src={src} 
                alt={alt} 
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
