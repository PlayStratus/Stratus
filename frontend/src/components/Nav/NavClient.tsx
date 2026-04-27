"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Menu } from "lucide-react"

import Logo from "./stratus-logo.png"

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
          <Link href='/'>
            <Image src={Logo} alt='Stratus' height={34} />
          </Link>

          <div className='hidden md:flex items-center'>
            <Link href='/browse'>
              <Button variant='link'>Browse</Button>
            </Link>

            <Link href='/about'>
              <Button variant='link'>About</Button>
            </Link>
          </div>
        </div>

        <div className='flex-1 max-w-xl mx-0 md:mx-4'>
          <SearchBar games={games} />
        </div>

        <div className='flex items-center gap-2'>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>{user.Username}</Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align='end'>
                <DropdownMenuItem asChild>
                  <button
                    type='button'
                    onClick={handleLogout}
                    className='w-full cursor-pointer text-left'
                  >
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

          <div className='md:hidden'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' aria-label='Menu'>
                  <Menu className='h-5 w-5' />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align='end'>
                <DropdownMenuItem asChild>
                  <Link href='/browse' className='w-full cursor-pointer'>
                    Browse
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href='/about' className='w-full cursor-pointer'>
                    About
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
