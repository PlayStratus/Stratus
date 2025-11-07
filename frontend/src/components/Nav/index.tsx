import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import Link from "next/link"
import { redirect } from "next/navigation"
import SearchBar from "./SearchBar"

async function handleLogout() {
  "use server"

  redirect("/")
}

export default function Nav() {
  return (
    <nav className='sticky top-0 left-0 right-0 z-40 border-b bg-background/95 backdrop-blur'>
      <div className='container flex h-16 items-center justify-between px-4 mx-auto gap-4'>
        <div className='flex items-center gap-4'>
          <h1 className='text-xl font-bold'>Stratus</h1>

          <Link href='/browse'>
            <Button variant='link'>Browse</Button>
          </Link>
        </div>

        <div className='flex-1 max-w-xl mx-4'>
          <SearchBar />
        </div>

        <div className='flex items-center'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Account</Button>
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
