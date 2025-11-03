import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

const featuredGames = [
  {
    name: "Solitaire",
    description:
      "A single-player card game where you arrange cards into suit-based foundations, clearing the tableau through strategic moves and sequencing.",
  },
  {
    name: "Chess",
    description:
      "A two-player strategy board game where each side maneuvers pieces to checkmate the opponent's king.",
  },
  {
    name: "Minecraft",
    description:
      "A sandbox building and exploration game where you mine resources, craft tools, and build structures in a procedurally generated world.",
  },
  {
    name: "Sudoku",
    description:
      "A logic-based number-placement puzzle: fill a 9x9 grid so each row, column, and 3x3 box contains digits 1-9.",
  },
]

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
    <main className='min-h-screen container mx-auto'>
      <div className='flex flex-col items-center justify-center px-4 py-20 text-center max-w-6xl mx-auto'>
        <h1 className='text-6xl md:text-8xl font-extrabold mb-6'>Stratus</h1>

        <p className='text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl'>
          The Beaver's Game Streaming Service
        </p>

        <div className='flex flex-col sm:flex-row gap-4'>
          <Link
            href='/signup'
            className={buttonVariants({
              size: "lg",
              className: "text-lg px-10 py-6",
            })}
          >
            Get Started
          </Link>

          <Link
            href='/login'
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

      <div className='px-4 py-16 w-full'>
        <h2 className='text-3xl md:text-4xl font-bold mb-4'>Featured Games</h2>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
          {featuredGames.map((game, index) => (
            <Card
              key={index}
              className='group relative transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-1'
            >
              <CardContent className='flex flex-col h-full'>
                <CardTitle className='text-xl font-semibold mb-2 group-hover:text-primary transition-colors'>
                  {game.name}
                </CardTitle>

                <CardDescription className='grow'>
                  {game.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className='px-4 py-16 mx-auto'>
        <h2 className='text-3xl md:text-4xl font-bold mb-4'>About Us</h2>

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
