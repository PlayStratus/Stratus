"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Menu } from "lucide-react"
import { useEffect, useState } from "react"

import Logo from "@/assets/stratus-logo.png"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth/AuthProvider"

import type { GameType } from "@/lib/types"

import SearchBar from "./SearchBar"

type Props = {
  games: GameType[]
  revealOnScroll?: boolean
  hideSearchBar?: boolean
}

export default function NavClient({
  games,
  revealOnScroll = false,
  hideSearchBar = false,
}: Readonly<Props>) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isRevealed, setIsRevealed] = useState(!revealOnScroll)

  useEffect(() => {
    if (!revealOnScroll) {
      setIsRevealed(true)
      return
    }

    const updateNavVisibility = () => {
      setIsRevealed(window.scrollY > 96)
    }

    updateNavVisibility()
    window.addEventListener("scroll", updateNavVisibility, { passive: true })

    return () => {
      window.removeEventListener("scroll", updateNavVisibility)
    }
  }, [revealOnScroll])

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  return (
    <nav
      className={
        (revealOnScroll
          ? "fixed transition-all duration-300 ease-out "
          : "sticky ") +
        "top-0 left-0 right-0 z-40 border-b bg-background/95 backdrop-blur " +
        (isRevealed
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0")
      }
    >
      <div className='container flex h-16 items-center justify-between px-4 mx-auto gap-4'>
        <div className='flex items-center gap-6'>
          <Link href='/'>
            <Image src={Logo} alt='Stratus' className='h-8 w-auto' />
          </Link>

          <div className='hidden items-center gap-6 md:flex'>
            <Link
              href='/'
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
            >
              Home
            </Link>

            <Link
              href='/#Blogs'
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
            >
              Blogs
            </Link>

            <Link
              href='/browse'
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
            >
              Browse
            </Link>
          </div>
        </div>

        {!hideSearchBar && (
          <div className='flex-1 max-w-xl mx-0 md:mx-4'>
            <SearchBar games={games} />
          </div>
        )}

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
                  <Link href='/' className='w-full cursor-pointer'>
                    Home
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href='/#Blogs' className='w-full cursor-pointer'>
                    Blogs
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href='/browse' className='w-full cursor-pointer'>
                    Browse
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
