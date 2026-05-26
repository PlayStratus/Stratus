import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

import { getGameById } from "@/lib/actions/games"
import { isStaticExport } from "@/lib/static-export"
import { cn } from "@/lib/utils"

import Client from "./Client"

type Props = {
  params: Promise<{ id: string }>
}

export const generateStaticParams = isStaticExport
  ? () => [{ id: "__static-export-placeholder__" }]
  : undefined

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (isStaticExport) {
    return {
      title: "Play",
    }
  }

  const { id } = await params
  const game = await getGameById(id)

  return {
    title: game ? `Play ${game.title}` : "Game Not Found",
  }
}

export default async function PlayPage({ params }: Readonly<Props>) {
  if (isStaticExport) {
    return null
  }

  const { id } = await params

  const game = await getGameById(id)

  if (!game) {
    return (
      <main className='container mx-auto flex flex-1 flex-col px-4 py-10 sm:px-6 lg:px-8'>
        <Link
          href='/browse'
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
        >
          <ArrowLeft />
          Back to Browse
        </Link>

        <div className='mt-12 max-w-xl'>
          <p className='text-sm font-medium uppercase text-muted-foreground'>
            Game not found
          </p>
          <h1 className='mt-3 text-3xl font-bold sm:text-4xl'>
            This game is no longer available.
          </h1>
        </div>
      </main>
    )
  }

  return (
    <div className='flex flex-1'>
      <Client
        game={{
          id,
          title: game.title,
          developer: game.developer,
          coverImage: game.s3[0] ?? null,
        }}
      />
    </div>
  )
}
