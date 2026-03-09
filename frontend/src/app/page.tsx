import Link from "next/link"
import Image from "next/image"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { getGames } from "@/lib/actions/games"
import wordmarkLogo from "@/assets/wordmark-logo.png"

const games = await getGames()

// Test
const aboutUs = [
  {
    name: "Asher",
    description:
      "I am a CS major with a background in Linux, and I’m excited to work on the custom OS and Wayland compositor for this project.",
  },
  {
    name: "John",
    description:
      "I am pursuing a bachelor’s degree in Computer Science with a certificate in Cybersecurity, with front-end experience and a little backend experience.",
  },
  {
    name: "Carol",
    description:
      "I am a Graphic Design and CS double-major, and I was invited onto this project as a designer.",
  },
  {
    name: "Izzy",
    description:
      "I am an applied CS senior. I have some experience with full stack applications, so I’m looking forward to working on a few components of the project, trying to achieve a seamless experience streaming from the compositor to the web client.",
  },
  {
    name: "Amin",
    description:
      "I am a Computer science major with a focus in Cyber Security. I have experience with Systems Engineering and Unreal Engine. I am looking forward to getting this project up and running and doing whatever is possible to reduce latency.",
  },
  {
    name: "Nathen",
    description:
      "I am a CS major. Through personal projects, I have gained experience with full-stack web development, and through internships, I have also gained experience with audio processing.",
  },
]

export default function Home() {
  return (
    <main className='min-h-screen'>
      <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
        >
          <source src="/gradient.mp4" type="video/mp4" />
        </video>

        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-20 text-center max-w-6xl mx-auto">
          <div className="mb-6 w-[min(720px,92vw)]">
            <Image
              src={wordmarkLogo}
              alt="Stratus"
              priority
              className="h-auto w-full drop-shadow-md"
              sizes="(min-width: 768px) 720px, 92vw"
            />
          </div>

          <p className='text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl'>
            The Beaver's Game Streaming Service
          </p>

          <div className='flex flex-col sm:flex-row gap-4'>
            <Link
              href='/signin'
              className={buttonVariants({
                size: "lg",
                className: "text-lg px-10 py-6",
              })}
            >
              Get Started
            </Link>

            <Link
              href='/signin'
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "text-lg px-10 py-6",
              })}
            >
              Log In
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 select-none">
          <div className="flex flex-col items-center gap-2 text-sm tracking-wide text-foreground/70">
            <span className="motion-reduce:animate-none animate-pulse">
              Scroll for more
            </span>
            <div className="flex flex-col items-center leading-none">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 motion-reduce:animate-none animate-bounce"
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 -mt-2 motion-reduce:animate-none animate-bounce [animation-delay:150ms]"
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
            <Card
              key={index}
              className='group relative transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-1'
            >
              <CardContent className='flex flex-col h-full'>
                <CardTitle className='text-xl font-semibold mb-2 group-hover:text-primary transition-colors'>
                  {game.title}
                </CardTitle>

                <CardDescription className='grow'>
                  {game.sDescript}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className='container mx-auto px-4 py-16'>
        <div className='flex items-baseline gap-4 mb-4'>
          <h2 className='text-3xl md:text-4xl font-bold'>About Us</h2>
          <Link href='/about' className='text-primary hover:underline hover:text-primary/80 transition-colors font-medium'>
            See more
          </Link>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
          {aboutUs.map((info, index) => (
            <Card
              key={index}
              className='group relative transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-1'
            >
              <CardContent className='flex flex-col h-full'>
                <CardTitle className='text-xl font-semibold mb-2 group-hover:text-primary transition-colors'>
                  {info.name}
                </CardTitle>

                <CardDescription className='grow'>
                  {info.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
