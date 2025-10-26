import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import Link from "next/link"
import { redirect } from "next/navigation"

async function handleLogout() {
  "use server"

  redirect("/")
}

export default function Nav() {
  return (
    <nav className='fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur'>
      <div className='container flex h-16 items-center justify-center'>
        <div className='flex items-center gap-6'>
          <h1 className='text-xl font-bold'>Stratus</h1>

          <Link href='/browse'>
            <Button variant='ghost'>Browse</Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost'>Account</Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align='end'>
              <DropdownMenuItem asChild>
                <Link href='/settings'>Settings</Link>
              </DropdownMenuItem>

              <DropdownMenuItem>
                <form action={handleLogout}>
                  <button type='submit'>Log Out</button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
