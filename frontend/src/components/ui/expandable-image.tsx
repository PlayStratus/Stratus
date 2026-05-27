"use client"

import { useEffect, useRef, useState } from "react"
import Image, { type StaticImageData } from "next/image"
import { X } from "lucide-react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

interface ExpandableImageProps {
  src: string | StaticImageData
  alt: string
  width: number
  height: number
  className?: string
  imageClassName?: string
  sizes?: string
  modalSizes?: string
  unoptimized?: boolean
  showCaption?: boolean, // whether to show alt caption when not expanded
}

export function ExpandableImage({
  src,
  alt,
  width,
  height,
  className,
  imageClassName,
  sizes,
  modalSizes = "100vw",
  unoptimized,
  showCaption,
}: Readonly<ExpandableImageProps>) {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const closeImage = () => {
    const dialog = dialogRef.current

    if (dialog?.open) {
      dialog.close()
      return
    }

    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    const handleClose = () => setIsOpen(false)

    dialog.addEventListener("close", handleClose)

    if (!dialog.open) {
      dialog.showModal()
    }

    return () => dialog.removeEventListener("close", handleClose)
  }, [isOpen])

  return (
    <>
      <button
        type='button'
        className={cn(
          "block w-full cursor-pointer overflow-hidden group bg-transparent border-0 p-0 text-left",
          className,
        )}
        onClick={() => setIsOpen(true)}
        aria-label={alt}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          unoptimized={unoptimized}
          className={cn(
            "w-full h-auto object-contain transition-transform group-hover:scale-[1.02]",
            imageClassName,
          )}
        />
      </button>

      {showCaption && alt &&
        <p className='italic text-center mt-2'>{alt}</p>
      }

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <dialog
            ref={dialogRef}
            className='fixed inset-0 z-50 m-0 h-screen max-h-none w-screen max-w-none border-0 bg-black/90 p-4 backdrop:bg-black/90 backdrop:backdrop-blur-sm md:p-8 open:flex open:flex-col open:items-center open:justify-center animate-in fade-in duration-200 cursor-zoom-out'
            aria-label='Image viewer'
          >
            <button
              type='button'
              aria-label='Close image viewer'
              className='absolute inset-0 z-40 m-0 border-0 p-0 bg-transparent'
              onClick={closeImage}
            />
            <button
              type='button'
              className='absolute top-4 right-4 md:top-8 md:right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-60'
              onClick={closeImage}
            >
              <X size={32} />
              <span className='sr-only'>Close</span>
            </button>

            <div className='pointer-events-none relative flex min-h-0 w-full flex-1 cursor-default items-center justify-center'>
              <div className='pointer-events-auto relative h-full max-h-[90vh] w-full'>
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes={modalSizes}
                  unoptimized={unoptimized}
                  className='object-contain animate-in zoom-in-95 fade-in duration-200'
                />
              </div>
            </div>

            {alt ? (
              <p className='pointer-events-none mt-4 max-w-3xl text-center text-sm leading-6 text-white/80'>
                {alt}
              </p>
            ) : null}
          </dialog>,
          document.body,
        )}
    </>
  )
}
