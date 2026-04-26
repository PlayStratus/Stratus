import Link from "next/link"
import Image from "next/image"

import { getGames } from "@/lib/actions/games"
import { getAllBlogSummaries } from "@/lib/blogs"

import About from "@/components/About"
import BlogIndexClient from "@/components/blogs/BlogIndexClient"
import { buttonVariants } from "@/components/ui/button"
import Nav from "@/components/Nav"

import wordmarkLogo from "@/assets/wordmark-logo.png"

export const dynamic = "force-dynamic"

export default async function Home() {
  const games = await getGames()

  const posts = await getAllBlogSummaries()
  return (
    <main className='min-h-screen'>
      <Nav revealOnScroll />

      <section className='relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden'>
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-60'
        >
          <source src='/gradient.mp4' type='video/mp4' />
        </video>

        <div className='relative z-10 flex flex-col items-center justify-center px-4 py-20 text-center max-w-6xl mx-auto'>
          <div className='mb-6 w-[min(720px,92vw)]'>
            <Image
              src={wordmarkLogo}
              alt='Stratus'
              priority
              className='h-auto w-full drop-shadow-md'
              sizes='(min-width: 768px) 720px, 92vw'
            />
          </div>

          <p className='text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl'>
            Low-latency Linux-based Game Streaming Service
          </p>

          <div className='flex flex-col sm:flex-row gap-4'>
            <Link
              href='/signin'
              className={buttonVariants({
                size: "lg",
                className: "text-lg px-32 py-6",
              })}
            >
              Get Started
            </Link>
          </div>
        </div>

        <div className='pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 select-none'>
          <div className='flex flex-col items-center gap-2 text-sm tracking-wide text-foreground/70'>
            <span className='motion-reduce:animate-none animate-pulse'>
              Scroll for more
            </span>
            <div className='flex flex-col items-center leading-none'>
              <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className='h-4 w-4 motion-reduce:animate-none animate-bounce'
              >
                <path
                  d='M6 9l6 6 6-6'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
              <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className='h-4 w-4 -mt-2 motion-reduce:animate-none animate-bounce [animation-delay:150ms]'
              >
                <path
                  d='M6 9l6 6 6-6'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <div className='container mx-auto px-4 py-16 w-full'>
        <h2 className='text-3xl md:text-4xl font-bold mb-4'>Featured Games</h2>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
          {(games ?? []).map((game, index) => (
            <Link
              key={index}
              href={"/browse/" + game.GameID}
              className='group flex flex-col h-full hover:-translate-y-1 transition-all cursor-pointer rounded-lg shadow-md shadow-blue-400/30 hover:shadow-xl hover:shadow-blue-400/40'
            >
              <div className='w-full aspect-video overflow-hidden rounded-t-lg bg-muted relative'>
                {game?.s3[0] ? (
                  <img
                    src={game.s3[0]}
                    alt={game.title}
                    className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105'
                  />
                ) : (
                  <div className='w-full h-full flex items-center justify-center text-muted-foreground'>
                    No image
                  </div>
                )}
              </div>
              <div className='bg-card text-card-foreground px-4 py-3 rounded-b-lg border border-t-0 border-border flex flex-col grow'>
                <h3 className='font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1'>
                  {game.title}
                </h3>
                <p className='text-sm text-muted-foreground line-clamp-2'>
                  {game.sDescript}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <About />

      <div id='Blogs' className='container mx-auto px-4 py-8 scroll-mt-20'>
        <h1 className='text-4xl md:text-5xl font-bold mb-12'>Blogs</h1>

        <BlogIndexClient posts={posts} />
      </div>
    </main>
  )
}
