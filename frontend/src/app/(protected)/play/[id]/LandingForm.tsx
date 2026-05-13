"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Info,
  Play,
  TriangleAlert,
  XCircle,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DetailHoverCard,
  DetailHoverCardContent,
  DetailHoverCardTrigger,
} from "@/components/ui/detail-hover-card"

import { cn } from "@/lib/utils"

import {
  checkPlayPageBrowserSupport,
  createPendingBrowserSupportReport,
} from "../utils/browserSupport"

type Props = {
  game: {
    id: string
    title: string
    developer: string
    coverImage: string | null
  }
  errorMessage: string | null
  isStarting: boolean
  onStart: () => Promise<void>
}

const requirementStatusLabels = {
  checking: "Checking",
  supported: "Ready",
  unsupported: "Unavailable",
} as const

export default function LandingForm({
  game,
  errorMessage,
  isStarting,
  onStart,
}: Readonly<Props>) {
  const [browserSupport, setBrowserSupport] = useState(
    createPendingBrowserSupportReport(),
  )

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const report = await checkPlayPageBrowserSupport()
      if (!cancelled) {
        setBrowserSupport(report)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const isCheckingSupport = browserSupport.requirements.some(
    (requirement) => requirement.status === "checking",
  )
  const hasUnsupportedRequirement = browserSupport.requirements.some(
    (requirement) => requirement.status === "unsupported",
  )
  const allRequirementsSupported =
    !isCheckingSupport && !hasUnsupportedRequirement
  const launchLabel = isStarting
    ? "Launching..."
    : isCheckingSupport
      ? "Checking Browser..."
      : hasUnsupportedRequirement
        ? "Browser Unsupported"
        : "Start Game"

  return (
    <main className='container mx-auto flex flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12'>
      <Link
        href={`/browse/${game.id}`}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "mb-6 w-fit sm:mb-8",
        )}
      >
        <ArrowLeft />
        Back to {game.title}
      </Link>

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.78fr)] lg:items-start lg:gap-10'>
        <section className='min-w-0 overflow-hidden rounded-lg border bg-muted shadow-sm'>
          <div className='relative aspect-video'>
            {game.coverImage ? (
              <img
                src={game.coverImage}
                alt={`${game.title} cover`}
                className='h-full w-full object-cover'
              />
            ) : (
              <div className='flex h-full w-full items-center justify-center text-sm text-muted-foreground'>
                No image available
              </div>
            )}
            <div className='absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/10' />
            <div className='absolute bottom-0 left-0 right-0 p-5 text-white sm:p-6'>
              <p className='text-xs font-semibold uppercase text-white/75'>
                {game.developer}
              </p>
              <h1 className='mt-2 wrap-break-words text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl'>
                {game.title}
              </h1>
            </div>
          </div>
        </section>

        <section className='min-w-0 rounded-lg border bg-card p-4 shadow-sm sm:p-5'>
          <div className='space-y-3'>
            {errorMessage && (
              <Alert variant='destructive'>
                <TriangleAlert />
                <AlertTitle>Unable to start session</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <DetailHoverCard openDelay={120} closeDelay={80}>
              <DetailHoverCardTrigger asChild>
                <button
                  type='button'
                  className='flex w-full items-start gap-3 rounded-lg border bg-background/60 p-3.5 text-left transition hover:bg-background/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
                >
                  {allRequirementsSupported ? (
                    <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-500' />
                  ) : hasUnsupportedRequirement ? (
                    <XCircle className='mt-0.5 size-5 shrink-0 text-destructive' />
                  ) : (
                    <CircleDashed className='mt-0.5 size-5 shrink-0 text-muted-foreground' />
                  )}

                  <span className='min-w-0 flex-1'>
                    <span className='block text-base font-semibold'>
                      Browser compatibility
                    </span>
                    <span className='mt-1 block text-sm leading-5 text-muted-foreground'>
                      {allRequirementsSupported
                        ? "Ready to launch"
                        : hasUnsupportedRequirement
                          ? "Missing a required feature"
                          : "Checking required features"}
                    </span>
                  </span>

                  <Info className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                </button>
              </DetailHoverCardTrigger>

              <DetailHoverCardContent
                align='end'
                className='w-[min(24rem,calc(100vw-2rem))] p-3'
              >
                <ul className='grid gap-2'>
                  {browserSupport.requirements.map((requirement) => {
                    const StatusIcon =
                      requirement.status === "supported"
                        ? CheckCircle2
                        : requirement.status === "unsupported"
                          ? XCircle
                          : CircleDashed

                    return (
                      <li
                        key={requirement.key}
                        className='flex items-start gap-3 rounded-md border bg-background/60 p-3'
                      >
                        <StatusIcon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            requirement.status === "supported" &&
                              "text-emerald-500",
                            requirement.status === "checking" &&
                              "text-muted-foreground",
                            requirement.status === "unsupported" &&
                              "text-destructive",
                          )}
                        />
                        <div className='min-w-0'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <p className='font-medium leading-5'>
                              {requirement.label}
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                requirement.status === "supported" &&
                                  "bg-emerald-500/12",
                                requirement.status === "checking" &&
                                  "bg-amber-500/12",
                                requirement.status === "unsupported" &&
                                  "bg-destructive/12 text-destructive",
                              )}
                            >
                              {requirementStatusLabels[requirement.status]}
                            </span>
                          </div>
                          <p className='mt-1 text-sm leading-5 text-muted-foreground'>
                            {requirement.detail}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </DetailHoverCardContent>
            </DetailHoverCard>

            <Button
              size='lg'
              className={cn(
                "h-11 w-full text-base font-semibold sm:h-10",
                hasUnsupportedRequirement
                  ? "cursor-not-allowed"
                  : "cursor-pointer",
              )}
              disabled={
                isStarting || isCheckingSupport || hasUnsupportedRequirement
              }
              onClick={() => {
                void onStart()
              }}
            >
              <Play />
              {launchLabel}
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
