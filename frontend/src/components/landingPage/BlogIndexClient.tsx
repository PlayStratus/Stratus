"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { HoverCard } from "@/components/ui/hover-card"

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
      <Card className='gap-4 border-border/70 p-6'>
        <CardContent className='grid gap-4 px-0'>
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
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Filter by tags
              </CardTitle>
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
        </CardContent>
      </Card>

      <div className='flex items-center justify-between gap-4'>
        <p className='text-sm text-muted-foreground'>
          Showing {filteredPosts.length} of {posts.length} posts
        </p>
      </div>

      {filteredPosts.length > 0 ? (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
          {filteredPosts.map((post) => (
            <HoverCard
              key={post.slug}
              href={`/blogs/${post.slug}`}
              className='h-full cursor-pointer gap-0 overflow-hidden rounded-lg py-0 shadow-blue-400/30 hover:shadow-blue-400/40'
            >
              <div className='w-full aspect-[16/9] overflow-hidden rounded-t-lg bg-muted relative'>
                <img
                  src={post.imageUrl}
                  alt={post.title}
                  className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
                />
              </div>
              <CardContent className='flex grow flex-col px-4 py-3'>
                <CardTitle className='mb-1 text-lg font-semibold group-hover:text-primary transition-colors line-clamp-1'>
                  {post.title}
                </CardTitle>
                <CardDescription className='line-clamp-2'>
                  {post.author}
                </CardDescription>

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
              </CardContent>
            </HoverCard>
          ))}
        </div>
      ) : (
        <Card className='border-dashed border-border/70 bg-card'>
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
