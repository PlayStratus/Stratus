"use client"

import Link from "next/link"
import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import type { BlogSummary } from "@/lib/blogs"

type Props = {
  posts: BlogSummary[]
}

export default function BlogIndexClient({ posts }: Readonly<Props>) {
  const [query, setQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const normalizedQuery = query.trim().toLowerCase()
  const availableTags = [...new Set(posts.flatMap((post) => post.tags))].sort(
    (a, b) => a.localeCompare(b),
  )

  const filteredPosts = posts.filter((post) => {
    const matchesQuery =
      normalizedQuery === "" || post.searchText.includes(normalizedQuery)
    const matchesTags =
      selectedTags.length === 0 ||
      post.tags.some((tag) => selectedTags.includes(tag))

    return matchesQuery && matchesTags
  })

  function toggleTag(tag: string) {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag],
    )
  }

  return (
    <div className='space-y-8'>
      <div className='grid gap-4 rounded-2xl border border-border/70 bg-card/60 p-6 shadow-sm'>
        <Input
          type='search'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search blogs...'
          aria-label='Search blogs'
          className='h-11'
        />

        <div className='grid gap-3'>
          <div className='flex items-center justify-between gap-4'>
            <h3 className='text-sm font-medium text-muted-foreground'>
              Filter by tags
            </h3>
            {selectedTags.length > 0 ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => setSelectedTags([])}
                className='px-0 text-muted-foreground hover:text-foreground'
              >
                Clear filters
              </Button>
            ) : null}
          </div>

          <div className='flex flex-wrap gap-2'>
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag)

              return (
                <Button
                  key={tag}
                  type='button'
                  variant={isSelected ? "default" : "outline"}
                  size='sm'
                  onClick={() => toggleTag(tag)}
                  className='rounded-full'
                >
                  {tag}
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      <div className='flex items-center justify-between gap-4'>
        <p className='text-sm text-muted-foreground'>
          Showing {filteredPosts.length} of {posts.length} posts
        </p>
      </div>

      {filteredPosts.length > 0 ? (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
          {filteredPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blogs/${post.slug}`}
              className='group flex flex-col h-full hover:-translate-y-1 transition-all cursor-pointer rounded-lg shadow-md shadow-blue-400/30 hover:shadow-xl hover:shadow-blue-400/40'
            >
              <div className='w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-muted relative'>
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
                />
              </div>
              <div className='bg-card text-card-foreground px-4 py-3 rounded-b-lg border border-t-0 border-border flex flex-col flex-grow'>
                <h3 className='font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1'>
                  {post.title}
                </h3>
                <p className='text-sm text-muted-foreground line-clamp-2'>
                  {post.author}
                </p>

                <div className='mt-auto flex flex-wrap gap-2'>
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className='rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className='border-dashed border-border/70 bg-card/50'>
          <CardContent className='px-6 py-10 text-center'>
            <CardTitle className='text-2xl'>No matching posts</CardTitle>
            <CardDescription className='mt-2 text-base'>
              Try a different search term or clear the selected tags.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
