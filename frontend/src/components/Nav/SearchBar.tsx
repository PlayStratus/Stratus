"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

import { GameType } from "@/lib/types"

export default function SearchBar({ games }: { games: GameType[] }) {
  const [value, setValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [filteredItems, setFilteredItems] = useState<GameType[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.trim() === "") {
      setIsOpen(false)
      setFilteredItems([])
      return
    }
    const filtered = games.filter((game) =>
      game.title.toLowerCase().includes(value.toLowerCase()),
    )
    setFilteredItems(filtered)
    setIsOpen(filtered.length > 0)
  }, [value, games])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className='relative'>
      <Search className='pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground' />
      <Input
        ref={inputRef}
        type='text'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Search...'
        className={
          "h-10 rounded-xl bg-background/70 pl-9 pr-9 shadow-inner shadow-black/10 transition-all placeholder:text-muted-foreground/80 " +
          (isOpen
            ? "rounded-b-none border-ring/60 ring-2 ring-ring/20"
            : "hover:bg-background/85")
        }
      />

      {isOpen && (
        <Card
          ref={dropdownRef}
          className='absolute z-50 mt-0 max-h-72 w-full gap-0 overflow-y-auto rounded-t-none border-t-0 border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-xl shadow-black/25 backdrop-blur'
        >
          {filteredItems.map((item) => {
            const metadata = item.developer || item.genres.slice(0, 2).join(", ")

            return (
              <Link
                href={"/browse/" + item.GameID}
                key={item.GameID}
                onClick={() => setValue("")}
                className='group flex min-h-12 items-center rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'
              >
                <span className='min-w-0'>
                  <span className='block truncate font-medium leading-5'>
                    {item.title}
                  </span>
                  {metadata && (
                    <span className='block truncate text-xs leading-4 text-muted-foreground group-hover:text-accent-foreground/75'>
                      {metadata}
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </Card>
      )}
    </div>
  )
}
