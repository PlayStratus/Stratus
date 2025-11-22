"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

import { getGames } from "@/lib/actions/games"
import { GameType } from "@/lib/types"

export default function SearchBar() {
  const [games, setGames] = useState<GameType[]>([])
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
      game.title.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredItems(filtered)
    setIsOpen(filtered.length > 0)
  }, [value])

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

    const fetchGames = async () => {
      try {
        const games = await getGames()
        setGames(games ?? [])
      } catch (error) {
        console.error("Error fetching games:", error)
      }
    }

    fetchGames()

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className='relative'>
      <Input
        ref={inputRef}
        type='text'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Search...'
      />

      {isOpen && (
        <Card
          ref={dropdownRef}
          className='absolute w-full mt-1 max-h-60 overflow-y-auto z-50 p-1'
        >
          {filteredItems.map((item, index) => (
            <Link
              href={"/browse/" + item.GameID}
              key={index}
              onClick={() => setValue("")}
              className={
                "px-3 py-2 rounded-sm transition-colors hover:bg-accent/50"
              }
            >
              {item.title}
            </Link>
          ))}
        </Card>
      )}
    </div>
  )
}
