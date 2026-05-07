import Link from "next/link"
import Image from "next/image"
import { MonitorPlay, Zap, Code, Leaf } from "lucide-react"

import { getGames } from "@/lib/actions/games"
import { getAllBlogSummaries } from "@/lib/blogs"

import BlogIndexClient from "@/components/blogs/BlogIndexClient"
import { buttonVariants } from "@/components/ui/button"
import Nav from "@/components/Nav"
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { ExpandableImage } from "@/components/ui/expandable-image"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

import wordmarkLogo from "@/assets/wordmark-logo.png"

export const dynamic = "force-dynamic"

const teamMembers = [
  { name: "Amin Hussien", description: "Team lead & backend developer. BSc in Computer Science." },
  { name: "Asher Morgan", description: "Backend developer. BSc in Computer Systems." },
  { name: "Carol Rang", description: "Designer & frontend developer, BFA Graphic Design and BSc Applied Computer Science" },
  { name: "Izzy Lerman", description: "Backend developer. BSc in Computer Science." },
  { name: "John Polasek", description: "Full stack developer. BSc in Computer Systems, Certificate in Cybersecurity." },
  { name: "Nathen dela Torre", description: "Full stack developer. BSc in Computer Science." }
]

const faqs = [
  { question: "What are the system requirements?", answer: "A powerful computer is not needed to use Stratus since games are run remotely on Stratus' servers. Stratus works in Google Chrome on all major operating systems, although some users may need to disable graphics acceleration in the Chrome settings. However, Stratus does require a game controller, as keyboard & mouse input is not currently supported." },
  { question: "How fast is it? How does it compare to Google Stadia / Nvidia GeForce NOW / Amazon Luna?", answer: "Stratus is capable of streaming at 1080p at 60fps with an end-to-end latency of as little as 60ms, depending on local network latency and bandwidth." },
  { question: "What games are supported?", answer: "Stratus is capable of streaming most games that run natively on Windows or Linux with controller support. The Stratus library currently contains various popular open-source games including SuperTux, SuperTuxKart, and Freedoom." },
  { question: "What hardware do the servers run on?", answer: "The Stratus servers were designed for and tested on a cluster of 12 BC-250s that was originally created to mine cryptocurrency. Each BC-250 contains a PlayStation 5 APU with 6 CPU cores and 16 GB of RAM, making them a great fit for game streaming." },
  { question: "Is Stratus available to the public?", answer: "Stratus is currently only available to students at Oregon State University. We unfortunately have no plans to expand access due to hosting costs and complexities." }
]

export default async function Home() {
  const games = await getGames()
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

          <p className='text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl font-medium'>
            An open source game streaming service
          </p>

          <div className='flex flex-col sm:flex-row gap-4'>
            <Link
              href='/signin'
              className={buttonVariants({
                size: "lg",
                className: "text-xl px-32 py-6 shadow-lg shadow-primary/25 transition-transform hover:-translate-y-1 hover:shadow-primary/40",
              })}
            >
              Play now!
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

      {/* Featured Games Section */}
      <div className='container mx-auto px-4 py-24 w-full max-w-7xl'>
        <h2 className='text-3xl md:text-4xl font-bold mb-8 text-center'>Featured Games</h2>

        <Carousel className='w-full'>
          <CarouselContent className='-ml-4'>
            {(games ?? []).map((game, index) => (
              <CarouselItem key={index} className='pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4'>
                <Link
                  href={"/browse/" + game.GameID}
                  className='group flex flex-col h-full hover:-translate-y-1.5 transition-all cursor-pointer rounded-lg shadow-md shadow-blue-400/20 hover:shadow-xl hover:shadow-blue-400/30'
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
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className='hidden sm:block'>
            <CarouselPrevious className='-left-4 lg:-left-12' />
            <CarouselNext className='-right-4 lg:-right-12' />
          </div>
        </Carousel>
      </div>

      {/* Highlights / Features Section */}
      <div className='bg-muted/30 py-20 w-full border-y border-border/50'>
        <div className='container mx-auto px-4 max-w-6xl'>
          <div className='text-center mb-16'>
            <p className='text-xl md:text-2xl text-foreground max-w-3xl mx-auto font-medium leading-relaxed'>
              Stratus is a game streaming service that enables users to play games directly from their web browser.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
            <div className='flex flex-col items-center text-center p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow hover:border-primary/30'>
              <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
                <MonitorPlay className='h-6 w-6 text-primary' />
              </div>
              <h4 className='text-xl font-semibold mb-2'>Compatible</h4>
              <p className='text-muted-foreground'>Stratus works on any device and supports any Windows- or Linux-native game</p>
            </div>

            <div className='flex flex-col items-center text-center p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow hover:border-primary/30'>
              <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
                <Zap className='h-6 w-6 text-primary' />
              </div>
              <h4 className='text-xl font-semibold mb-2'>Fast</h4>
              <p className='text-muted-foreground'>Stratus can stream in 1080p at 60fps with round-trip latencies of as little as 60ms</p>
            </div>

            <div className='flex flex-col items-center text-center p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow hover:border-primary/30'>
              <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
                <Code className='h-6 w-6 text-primary' />
              </div>
              <h4 className='text-xl font-semibold mb-2'>Open Source</h4>
              <p className='text-muted-foreground'>The complete source code for Stratus is available on GitHub</p>
            </div>

            <div className='flex flex-col items-center text-center p-6 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow hover:border-primary/30'>
              <div className='h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
                <Leaf className='h-6 w-6 text-primary' />
              </div>
              <h4 className='text-xl font-semibold mb-2'>Sustainable</h4>
              <p className='text-muted-foreground'>The Stratus servers run on recycled crypto-miners</p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Section */}
      <div className='py-20 w-full'>
        <div className='container mx-auto px-4 max-w-5xl'>
          <h2 className='text-3xl md:text-4xl font-bold mb-10 text-center'>Demo</h2>
          <Carousel className='w-full'>
            <CarouselContent>
              <CarouselItem>
                <div className='overflow-hidden rounded-xl border border-border shadow-lg p-1 bg-card'>
                  <ExpandableImage
                    src='/Gaming.jpg'
                    alt='Stratus Gameplay'
                    width={1200}
                    height={800}
                    className='w-full aspect-[16/9] flex items-center justify-center rounded-lg overflow-hidden bg-black/5'
                    imageClassName='w-full h-full object-cover object-center'
                  />
                </div>
              </CarouselItem>
              <CarouselItem>
                <div className='overflow-hidden rounded-xl border border-border shadow-lg p-1 bg-card'>
                  <ExpandableImage
                    src='/diagrams/communication-pipeline.png'
                    alt='Stratus Pipeline'
                    width={1200}
                    height={800}
                    className='w-full aspect-[16/9] flex items-center justify-center rounded-lg overflow-hidden bg-white p-4'
                    imageClassName='w-full h-full object-contain object-center'
                  />
                </div>
              </CarouselItem>
            </CarouselContent>
            <div className='hidden sm:block'>
              <CarouselPrevious className='-left-12' />
              <CarouselNext className='-right-12' />
            </div>
          </Carousel>
        </div>
      </div>

      {/* Our Team Section */}
      <div className='bg-muted/30 py-20 w-full border-y border-border/50'>
        <div className='container mx-auto px-4 max-w-6xl'>
          <h2 className='text-3xl md:text-4xl font-bold mb-6 text-center'>Our Team</h2>
          <p className='text-lg text-muted-foreground mb-12 text-center max-w-3xl mx-auto'>
            Stratus was developed by a team of six Oregon State University students as a senior capstone project:
          </p>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {teamMembers.map((member) => (
              <Card key={member.name} className='group relative transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-1 bg-card'>
                <CardContent className='flex flex-col h-full pt-6'>
                  <CardTitle className='text-xl font-semibold mb-2 group-hover:text-primary transition-colors'>
                    {member.name}
                  </CardTitle>
                  <CardDescription className='grow text-base'>
                    {member.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Blog Section */}
      <div id='Blogs' className='py-20 w-full'>
        <div className='container mx-auto px-4 max-w-6xl scroll-mt-20'>
          <h2 className='text-3xl md:text-4xl font-bold mb-6 text-center'>Blog</h2>
          <p className='text-lg text-muted-foreground mb-12 text-center max-w-3xl mx-auto'>
            Learn more about Stratus’s architecture, implementation, and performance on our blog:
          </p>
          <BlogIndexClient posts={posts} />
        </div>
      </div>

      {/* FAQ Section */}
      <div className='bg-muted/30 py-20 w-full border-t border-border/50'>
        <div className='container mx-auto px-4 max-w-3xl'>
          <h2 className='text-3xl md:text-4xl font-bold mb-10 text-center'>FAQ</h2>
          <div className='space-y-4'>
            {faqs.map((faq, index) => (
              <details key={index} className='group border border-border rounded-lg bg-card overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm'>
                <summary className='flex items-center justify-between px-6 py-4 cursor-pointer font-semibold text-lg hover:bg-muted/50 transition-colors'>
                  {faq.question}
                  <span className='transition duration-300 group-open:rotate-180 text-muted-foreground group-hover:text-foreground'>
                    <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                  </span>
                </summary>
                <div className='px-6 pb-5 pt-2 text-muted-foreground text-base leading-relaxed border-t border-border/50 bg-muted/10'>
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
