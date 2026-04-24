import Link from "next/link"
import Nav from "@/components/Nav"
import { ExpandableImage } from "@/components/ui/expandable-image"
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

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

export default function About() {
  return (
    <main className="min-h-screen">
      <Nav />
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-12">About Stratus</h1>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-4">Stratus Overview</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Stratus is a low-latency game streaming service that enables users to play games from their web browser, similarly to past and present services such as Google Stadia, Amazon Luna, and GeForce NOW. Stratus offers identical functionality and comparable performance to these commercial alternatives, but was developed using far fewer resources and much less money.
          </p>
        </section>

        <section className="mb-16">

          <h2 className="text-2xl font-semibold mb-4">Stratus Key Features</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            Our project has several features that stand out. We were able to successfully implement a low latency video service which is a huge task in itself. This was our MVP and the primary feature. Additionally we successfully implemented user input and audio. User input currently has little delay, and audio lines up with the frames that are shown on screen. This is all hosted on a machine that does not have to be located near you. Meaning you can play games you want on any device without having to install or need to have a great computer to run intense games.
          </p>
            
          <ExpandableImage 
            src="/Gaming.jpg" 
            alt="Active User" 
            width={1000} 
            height={500} 
            className="w-full md:max-w-[40%] mx-auto relative rounded-xl border border-border bg-muted mb-12 shadow-sm"
          />
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">Our Team</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {aboutUs.map((info, index) => (
            <Card
              key={index}
              className="group relative transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-1"
            >
              <CardContent className="flex flex-col h-full pt-6">
                <CardTitle className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {info.name}
                </CardTitle>

                <CardDescription className="grow">
                  {info.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold mb-8">Getting Started</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-12">
            Click <Link
              href='/signin'
              className='underline hover:text-primary/80 transition-colors font-medium'
            >here</Link> to create an account and try it out. You can also send
            us questions or feedback via <Link
              href='https://github.com/PlayStratus/Stratus'
              className='underline hover:text-primary/80 transition-colors font-medium'
            >GitHub</Link>. And if you're interested, continue reading for the
            technical implementation details.
          </p>

          <h2 className="text-2xl font-semibold mb-4">Stratus Architecture</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            The Stratus service is composed of three main components: the web frontend, the coordination server, and the stream servers. Each of these is described in more detail below.
          </p>
          
          <ExpandableImage 
            src="/diagrams/communication-pipeline.png" 
            alt="Overall Architecture Diagram" 
            width={1000} 
            height={500} 
            className="w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted mb-12 shadow-sm"
          />

          <div className="space-y-16">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Web Frontend</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                The web frontend allows the user to browse the Stratus game library, select a game, and then stream game I/O to their browser.
              </p>
              <ExpandableImage 
                src="/diagrams/site-map.png" 
                alt="Site map diagram" 
                width={1000} 
                height={500} 
                className="w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted my-6 shadow-sm"
              />
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Coordination Server</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                The Stratus coordination server runs in an AWS EC2 instance and is responsible for connecting frontend clients with stream servers for new game streaming sessions, in addition to providing the web frontend with APIs for user authentication and game library queries.
              </p>
              <ExpandableImage 
                src="/diagrams/overall-architecture.png" 
                alt="Backend architecture diagram" 
                width={1000} 
                height={500} 
                className="w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted my-6 shadow-sm"
              />
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">Stream Servers</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Stratus uses a cluster of 12 BC-250 stream servers running Linux to execute the games and stream game I/O. Each server runs a custom Stratus streaming software consisting of 5 modules, as shown below.
              </p>
              <ExpandableImage 
                src="/diagrams/backend-architecture.png" 
                alt="stratusd architecture diagram" 
                width={1000} 
                height={500} 
                className="w-full md:max-w-[50%] mx-auto relative rounded-xl border border-border bg-muted mb-8 mt-2 shadow-sm"
              />
              <p className="text-muted-foreground leading-relaxed">
                The SideCar module handles communication with the coordination server over a persistent WebSockets connection. When a request to start a new stream is received, the SideCar module is responsible for initializing every other module and then launching the game itself. The game’s video output is then captured by the Capture module via the Wayland protocol, encoded by the Encode module using ffmpeg, and finally sent to the client by the Transport module over Google’s QUICHE transport layer. The Transport module also receives game controller input sent by the client and forwards it to the Input module, which injects the input into the game via a virtual controller device.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
