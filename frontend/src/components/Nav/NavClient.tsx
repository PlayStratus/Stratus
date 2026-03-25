"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { GameType } from "@/lib/types"
import SearchBar from "./SearchBar"
import { useAuth } from "@/components/auth/AuthProvider"

export default function NavClient({ games }: { games: GameType[] }) {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  return (
    <nav className='sticky top-0 left-0 right-0 z-40 border-b bg-background/95 backdrop-blur'>
      <div className='container flex h-16 items-center justify-between px-4 mx-auto gap-4'>
        <div className='flex items-center gap-4'>
          <h1 className='text-xl font-bold'>Stratus</h1>

          <Link href='/browse'>
            <Button variant='link'>Browse</Button>
          </Link>

          <Link href='/about'>
            <Button variant='link'>About</Button>
          </Link>
        </div>

        <div className='flex-1 max-w-xl mx-4'>
          <SearchBar games={games} />
        </div>

        <div className='flex items-center'>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>{user.Username}</Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align='end'>
                <DropdownMenuItem asChild>
                  <Link href='/settings'>Settings</Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <button type='button' onClick={handleLogout}>
                    Log Out
                  </button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href='/signin'>
              <Button>Log In</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
