"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"

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
      game.title.toLowerCase().includes(value.toLowerCase())
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
