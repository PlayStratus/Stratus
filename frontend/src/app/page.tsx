import Link from "next/link"
import Image from "next/image"

import wordmarkLogo from "@/assets/wordmark-logo.png"

import { buttonVariants } from "@/components/ui/button"
import Nav from "@/components/Nav"

import BlogIndexClient from "@/components/landingPage/BlogIndexClient"
import FeaturedGames from "@/components/landingPage/FeaturedGames"
import Highlights from "@/components/landingPage/Highlights"
import Demo from "@/components/landingPage/Demo"
import Team from "@/components/landingPage/Team"
import Faq from "@/components/landingPage/Faq"

import { getAllBlogSummaries } from "@/lib/blogs"

export const dynamic = "force-dynamic"

export default async function Home() {
  const posts = await getAllBlogSummaries()

  return (
    <main className='min-h-screen'>
      <Nav revealOnScroll hideSearchBar />

      {/* Hero Section */}
      <section className='relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden'>
        <video
          autoPlay
          loop
          muted
          playsInline
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

          <p className='text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl font-medium'>
            A Web-Based Game Streaming Service
          </p>

          <div className='flex flex-col items-start gap-3'>
            <Link
              href='/signin'
              className={buttonVariants({
                size: "lg",
                className:
                  "text-xl px-32 py-6 shadow-lg shadow-primary/25 transition-transform hover:-translate-y-1 hover:shadow-primary/40 flex-col",
              })}
            >
              Play now!
              <span className='-mt-3 text-xs text-muted/70'>(closed beta)</span>
            </Link>

            <Link
              href='/direct-connect'
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:text-base'
            >
              Connect Directly
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

      {/* Highlights / Features Section */}
      <div className='container mx-auto px-4 py-24 w-full max-w-7xl'>
        <div className='text-center mb-16'>
          <p className='text-xl md:text-2xl text-foreground max-w-3xl mx-auto font-medium leading-relaxed'>
            Stratus is a game streaming service that enables users to play games
            directly from their web browser.
          </p>
        </div>

        <Highlights />
      </div>

      {/* Featured Games Section */}
      <div className='bg-muted/30 py-20 w-full border-y border-border/50'>
        <div className='container mx-auto px-4 max-w-6xl'>
          <h2 className='text-3xl md:text-4xl font-bold mb-8 text-center'>
            Featured Games
          </h2>

          <FeaturedGames />
        </div>
      </div>

      {/* Demo Section */}
      <div className='py-20 w-full'>
        <div className='container mx-auto px-4 max-w-5xl'>
          <Demo />
        </div>
      </div>

      {/* Blog Section */}
      <div
        id='Blogs'
        className='bg-muted/30 py-20 w-full border-y border-border/50'
      >
        <div className='container mx-auto px-4 max-w-6xl'>
          <h2 className='text-3xl md:text-4xl font-bold mb-6 text-center'>
            Blogs
          </h2>

          <p className='text-lg text-muted-foreground mb-12 text-center max-w-3xl mx-auto'>
            Learn more about Stratus’s architecture, implementation, and
            performance on our blog:
          </p>

          <BlogIndexClient posts={posts} />
        </div>
      </div>

      {/* Our Team Section */}
      <div className='py-20 w-full'>
        <div className='container mx-auto px-4 max-w-6xl scroll-mt-20'>
          <h2 className='text-3xl md:text-4xl font-bold mb-8 text-center'>
            Our Team
          </h2>

          <p className='text-lg text-muted-foreground mb-12 text-center max-w-3xl mx-auto'>
            Stratus was developed by a team of six Oregon State University
            students as a senior capstone project:
          </p>

          <Team />
        </div>
      </div>

      {/* FAQ Section */}
      <div className='bg-muted/30 py-20 w-full border-t border-border/50'>
        <div className='container mx-auto px-4 max-w-3xl'>
          <h2 className='text-3xl md:text-4xl font-bold mb-10 text-center'>
            FAQ
          </h2>

          <Faq />
        </div>
      </div>
    </main>
  )
}
