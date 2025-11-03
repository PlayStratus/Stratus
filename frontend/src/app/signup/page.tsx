import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { redirect } from "next/navigation"

async function handleSignUp(formData: FormData) {
  "use server"

  const username = formData.get("username")

  console.log(username)

  redirect("/browse")
}

export default function SignUp() {
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

        <form
          action={handleSignUp}
          className='w-full max-w-md bg-card p-8 rounded-lg border'
        >
          <div className='mb-4 text-left'>
            <Label
              htmlFor='username'
              className='block text-sm font-medium text-foreground mb-2'
            >
              Oregon State Email
            </Label>

            <Input
              type='username'
              id='username'
              name='username'
              placeholder='odin@oregonstate.edu'
              className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2'
            />
          </div>

          <div className='mb-4 text-left'>
            <Label
              htmlFor='username'
              className='block text-sm font-medium text-foreground mb-2'
            >
              Username
            </Label>

            <Input
              type='username'
              id='username'
              name='username'
              placeholder='Username'
              className='w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2'
            />
          </div>

          <Button type='submit' className='w-full py-2 rounded-lg'>
            Log In
          </Button>
        </form>
      </div>
    </main>
  )
}
