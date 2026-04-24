"use client"

import { useEffect, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TriangleAlert } from "lucide-react"

import {
  checkPlayPageBrowserSupport,
  createPendingBrowserSupportReport,
} from "../utils/browserSupport"

type Props = {
  title: string
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
  title,
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

  return (
    <Card className='m-auto w-full max-w-xl'>
      <CardHeader>
        <CardTitle className='text-2xl'>{title}</CardTitle>
      </CardHeader>

      <CardContent className='space-y-4'>
        {errorMessage && (
          <Alert variant='destructive'>
            <TriangleAlert />
            <AlertTitle>Unable to start session</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {hasUnsupportedRequirement && (
          <Alert variant='destructive'>
            <TriangleAlert />
            <AlertTitle>Browser requirements not met</AlertTitle>
            <AlertDescription>
              {browserSupport.requirements
                .filter((requirement) => requirement.status === "unsupported")
                .map((requirement) => requirement.detail)
                .join(" ")}
            </AlertDescription>
          </Alert>
        )}

        <div className='space-y-3 rounded-lg border p-4'>
          <div>
            <p className='font-medium'>Browser compatibility</p>
            <p className='text-sm text-muted-foreground'>
              The play page needs these features before it can launch.
            </p>
          </div>

          <ul className='space-y-3'>
            {browserSupport.requirements.map((requirement) => (
              <li
                key={requirement.key}
                className='flex items-start justify-between gap-4'
              >
                <div className='space-y-1'>
                  <p className='font-medium'>{requirement.label}</p>
                  <p className='text-sm text-muted-foreground'>
                    {requirement.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    requirement.status === "supported" && "bg-emerald-500/12",
                    requirement.status === "checking" && "bg-amber-500/12",
                    requirement.status === "unsupported" &&
                      "bg-destructive/12 text-destructive",
                  )}
                >
                  {requirementStatusLabels[requirement.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      <CardFooter className='justify-end'>
        <Button
          disabled={
            isStarting || isCheckingSupport || hasUnsupportedRequirement
          }
          onClick={() => {
            void onStart()
          }}
        >
          {isStarting
            ? "Launching..."
            : isCheckingSupport
              ? "Checking Browser..."
              : hasUnsupportedRequirement
                ? "Browser Unsupported"
                : "Start Game"}
        </Button>
      </CardFooter>
    </Card>
  )
}
