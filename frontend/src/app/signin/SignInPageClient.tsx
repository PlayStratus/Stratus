"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { useAuth } from "@/components/auth/AuthProvider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import SignInButton from "./SignInButton"

type SignInPageClientProps = {
  error: string | null
}

function SessionStatus() {
  return (
    <main className='flex min-h-screen items-center justify-center bg-linear-to-b from-background via-background to-muted/20 px-4'>
      <div className='text-center'>
        <p className='text-sm text-muted-foreground'>Checking session...</p>
      </div>
    </main>
  )
}

export default function SignInPageClient({
  error,
}: Readonly<SignInPageClientProps>) {
  const router = useRouter()
  const { status } = useAuth()

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/browse")
    }

    if (status === "needs-username") {
      router.replace("/signin/username")
    }
  }, [router, status])

  if (status !== "unauthenticated") {
    return <SessionStatus />
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background to-muted/20'>
      <div className='flex flex-col items-center justify-center space-y-8 px-4 py-16 text-center max-w-2xl w-full'>
        <Link
          href='/'
          className='self-start flex items-center gap-2 text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='w-5 h-5' />
          <span>Back to Home</span>
        </Link>

        <h1 className='text-4xl md:text-5xl font-extrabold tracking-tight'>
          Stratus
        </h1>

        <div className='w-full max-w-md bg-card p-8 rounded-lg border'>
          <div className='mb-4 p-3 border rounded-lg text-sm'>
            Sign in with your oregonstate.edu email address.
          </div>

          <SignInButton />

          {error && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  )

  // <main className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background via-background to-muted/20 px-4 py-16'>
  //   <div className='flex w-full max-w-md flex-col gap-8'>
  //     <Link
  //       href='/'
  //       className='flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground'
  //     >
  //       <ArrowLeft className='h-4 w-4' />
  //       <span>Back to Home</span>
  //     </Link>

  //     <Card className='overflow-hidden border-border/70 bg-card/95 shadow-xl shadow-black/10 backdrop-blur'>
  //       <CardHeader className='gap-4 border-b border-border/60 bg-muted/20'>
  //         <div className='space-y-2'>
  //           <p className='text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground'>
  //             Stratus Access
  //           </p>
  //           <CardTitle className='text-3xl font-bold tracking-tight'>
  //             Sign in with Google
  //           </CardTitle>
  //           <CardDescription className='max-w-sm text-sm leading-6'>
  //             Continue with your{" "}
  //             <span className='font-semibold text-foreground'>
  //               @oregonstate.edu
  //             </span>{" "}
  //             account to launch and manage your streaming sessions.
  //           </CardDescription>
  //         </div>
  //       </CardHeader>

  //       <CardContent className='space-y-5 pt-6'>
  //         <div className='rounded-lg border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground'>
  //           Existing users will go straight to the library. New users will be
  //           prompted to choose a username after Google sign-in.
  //         </div>

  //         <SignInButton />

  //         {error && (
  //           <div className='rounded-lg border border-red-500/70 bg-red-500/10 p-3 text-sm text-red-200'>
  //             {error}
  //           </div>
  //         )}
  //       </CardContent>
  //     </Card>
  //   </div>
  // </main>
  // )
}
