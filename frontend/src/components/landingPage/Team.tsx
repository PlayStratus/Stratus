import { BriefcaseBusiness, Globe, GraduationCap } from "lucide-react"
import Link from "next/link"

import { CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { LinkedinIcon, GithubIcon } from "@/components/ui/brand-icons"
import { HoverCard } from "@/components/ui/hover-card"

type TeamMember = {
  name: string
  role: string
  major: string
  links: {
    github?: string
    linkedin?: string
    website?: string
  }
}

const teamMembers: TeamMember[] = [
  {
    name: "Amin Hussien",
    role: "Team Lead & Backend Developer",
    major: "Computer Science",
    links: {
      github: "https://github.com/aminhussien",
      website: "https://amin.dev/",
    },
  },
  {
    name: "Asher Morgan",
    role: "Backend Developer",
    major: "Computer Science",
    links: {
      github: "https://github.com/ashermorgan",
      linkedin: "https://www.linkedin.com/in/asher-morgan/",
    },
  },
  {
    name: "Carol Rang",
    role: "Designer & Frontend Developer",
    major: "Graphic Design & Computer Science",
    links: {
      github: "https://github.com/carolr615",
      linkedin: "https://www.linkedin.com/in/carol-rang-2a670b32b/",
    },
  },
  {
    name: "Izzy Lerman",
    role: "Backend Developer",
    major: "Computer Science",
    links: {
      github: "https://github.com/IzzyLerman",
      linkedin: "https://www.linkedin.com/in/izzy-lerman/",
    },
  },
  {
    name: "John Polasek",
    role: "Full Stack Developer",
    major: "Computer Science",
    links: {
      github: "https://github.com/JohnOSU1",
      linkedin: "https://www.linkedin.com/in/johnpolasek/",
    },
  },
  {
    name: "Nathen dela Torre",
    role: "Full Stack Developer",
    major: "Computer Science",
    links: {
      github: "https://github.com/NathenDT",
      linkedin: "https://www.linkedin.com/in/NathenDT/",
    },
  },
]

export default function Team() {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
      {teamMembers.map((member) => (
        <HoverCard key={member.name}>
          <CardContent className='flex flex-col h-full gap-3 pt-5'>
            <CardTitle className='text-xl font-semibold group-hover:text-primary transition-colors'>
              {member.name}
            </CardTitle>

            <CardDescription className='grow space-y-1.5 text-sm'>
              <p className='flex items-center gap-2 font-medium text-foreground'>
                <BriefcaseBusiness
                  className='h-4 w-4 shrink-0 text-primary'
                  aria-hidden='true'
                />
                <span>{member.role}</span>
              </p>
              <p className='flex items-center gap-2'>
                <GraduationCap
                  className='h-4 w-4 shrink-0 text-primary'
                  aria-hidden='true'
                />
                <span>{member.major}</span>
              </p>
            </CardDescription>

            <hr className='border-border/80' />

            <div className='flex flex-row gap-2'>

            {member.links.github && (
              <Link
                href={member.links.github}
                target='_blank'
                rel='noreferrer'
                aria-label={`${member.name} on LinkedIn`}
                className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              >
                <GithubIcon className='h-4 w-4' aria-hidden='true' />
              </Link>
            )}

            {member.links.linkedin && (
              <Link
                href={member.links.linkedin}
                target='_blank'
                rel='noreferrer'
                aria-label={`${member.name} on LinkedIn`}
                className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              >
                <LinkedinIcon className='h-4 w-4' aria-hidden='true' />
              </Link>
            )}

            {member.links.website && (
              <Link
                href={member.links.website}
                target='_blank'
                rel='noreferrer'
                aria-label={`${member.name}'s website`}
                className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              >
                <Globe className='h-4 w-4' aria-hidden='true' />
              </Link>
            )}

            </div>
          </CardContent>
        </HoverCard>
      ))}
    </div>
  )
}
