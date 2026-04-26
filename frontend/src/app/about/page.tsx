import Link from "next/link"

import About from "@/components/About"
import Nav from "@/components/Nav"
import { ExpandableImage } from "@/components/ui/expandable-image"

export default function AboutPage() {
  return (
    <main className='min-h-screen'>
      <Nav />

      <About />

      <div className='container mx-auto px-4'>
        <section>
          <h2 className='text-3xl font-bold mb-8'>Getting Started</h2>
          <p className='text-lg text-muted-foreground leading-relaxed mb-12'>
            Click{" "}
            <Link
              href='/signin'
              className='underline hover:text-primary/80 transition-colors font-medium'
            >
              here
            </Link>{" "}
            to create an account and try it out. You can also send us questions
            or feedback via{" "}
            <Link
              href='https://github.com/PlayStratus/Stratus'
              className='underline hover:text-primary/80 transition-colors font-medium'
            >
              GitHub
            </Link>
            . And if you're interested, continue reading for the technical
            implementation details.
          </p>

          <h2 className='text-2xl font-semibold mb-4'>Stratus Architecture</h2>
          <p className='text-lg text-muted-foreground leading-relaxed mb-6'>
            The Stratus service is composed of three main components: the web
            frontend, the coordination server, and the stream servers. Each of
            these is described in more detail below.
          </p>

          <ExpandableImage
            src='/diagrams/communication-pipeline.png'
            alt='Overall Architecture Diagram'
            width={1000}
            height={500}
            className='w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted mb-12 shadow-sm'
          />

          <div className='space-y-16'>
            <div>
              <h3 className='text-2xl font-semibold mb-4'>Web Frontend</h3>
              <p className='text-muted-foreground leading-relaxed mb-6'>
                The web frontend allows the user to browse the Stratus game
                library, select a game, and then stream game I/O to their
                browser.
              </p>
              <ExpandableImage
                src='/diagrams/site-map.png'
                alt='Site map diagram'
                width={1000}
                height={500}
                className='w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted my-6 shadow-sm'
              />
            </div>

            <div>
              <h3 className='text-2xl font-semibold mb-4'>
                Coordination Server
              </h3>
              <p className='text-muted-foreground leading-relaxed mb-6'>
                The Stratus coordination server runs in an AWS EC2 instance and
                is responsible for connecting frontend clients with stream
                servers for new game streaming sessions, in addition to
                providing the web frontend with APIs for user authentication and
                game library queries.
              </p>
              <ExpandableImage
                src='/diagrams/overall-architecture.png'
                alt='Backend architecture diagram'
                width={1000}
                height={500}
                className='w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted my-6 shadow-sm'
              />
            </div>

            <div>
              <h3 className='text-2xl font-semibold mb-4'>Stream Servers</h3>
              <p className='text-muted-foreground leading-relaxed mb-6'>
                Stratus uses a cluster of 12 BC-250 stream servers running Linux
                to execute the games and stream game I/O. Each server runs a
                custom Stratus streaming software consisting of 5 modules, as
                shown below.
              </p>
              <ExpandableImage
                src='/diagrams/backend-architecture.png'
                alt='stratusd architecture diagram'
                width={1000}
                height={500}
                className='w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted mb-8 mt-2 shadow-sm'
              />
              <p className='text-muted-foreground leading-relaxed'>
                The SideCar module handles communication with the coordination
                server over a persistent WebSockets connection. When a request
                to start a new stream is received, the SideCar module is
                responsible for initializing every other module and then
                launching the game itself. The game’s video output is then
                captured by the Capture module via the Wayland protocol, encoded
                by the Encode module using ffmpeg, and finally sent to the
                client by the Transport module over Google’s QUICHE transport
                layer. The Transport module also receives game controller input
                sent by the client and forwards it to the Input module, which
                injects the input into the game via a virtual controller device.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
