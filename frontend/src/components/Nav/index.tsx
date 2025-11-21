import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getBackendPath } from "@/lib/backend/getBackendPath"

import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import SearchBar from "./SearchBar"

export default async function Nav() {
  const username = await getUserData()

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
              <Button>{username}</Button>
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

async function handleLogout() {
  "use server"

  try {
    await fetch(getBackendPath("/users/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    })

    const cookieStore = await cookies()
    cookieStore.delete("access_token")
    cookieStore.delete("refresh_token")
  } catch (error) {
    console.error("Logout error:", error)
  }

  redirect("/")
}

async function getUserData() {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")

  if (!authToken) {
    redirect("/signin")
  }

  try {
    const response = await fetch(getBackendPath("/users"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken.value}`,
      },
      cache: "no-store",
    })

    const data = await response.json()

    return data.user.Username
  } catch (error) {
    return redirect("/signin")
  }
}
