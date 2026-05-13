import Link from "next/link"
import Image from "next/image"

import wordmarkLogo from "@/assets/wordmark-logo.png"

import { GithubIcon } from "@/components/ui/brand-icons"

type Props = {
  logoLoading?: "eager" | "lazy"
}

export default function Footer({ logoLoading = "lazy" }: Readonly<Props>) {
  return (
    <footer className='relative w-full overflow-hidden border-t bg-background pt-14 pb-8 md:pt-20 md:pb-10'>
      <div className='pointer-events-none absolute inset-0 h-full w-full bg-linear-to-t from-primary/5 to-transparent' />

      <div className='container relative z-10 mx-auto flex flex-col gap-12 px-4 md:flex-row md:items-start md:justify-between'>
        <div className='flex flex-col items-center gap-5 text-center md:items-start md:text-left'>
          <Link href='/' className='group inline-block'>
            <Image
              src={wordmarkLogo}
              alt='Stratus'
              loading={logoLoading}
              className='h-10 w-auto brightness-0 invert drop-shadow-md transition-transform duration-300 group-hover:scale-105 md:h-14'
            />
          </Link>
          <p className='max-w-sm text-muted-foreground'>
            An open source game streaming service.
          </p>
        </div>

        <nav
          aria-label='Explore'
          className='flex flex-col items-center gap-4 text-center md:items-start md:text-left'
        >
          <h2 className='text-sm font-semibold uppercase tracking-widest text-foreground'>
            Explore
          </h2>
          <Link
            href='/'
            className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            Home
          </Link>
          <Link
            href='/#Blogs'
            className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            Blogs
          </Link>
          <Link
            href='/browse'
            className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            Browse
          </Link>
        </nav>

        <div className='flex flex-col items-center gap-4 text-center md:items-start md:text-left'>
          <h2 className='text-sm font-semibold uppercase tracking-widest text-foreground'>
            Source
          </h2>
          <a
            href='https://github.com/PlayStratus/Stratus'
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          >
            <GithubIcon className='h-4 w-4' aria-hidden='true' />
            GitHub
          </a>
        </div>
      </div>

      <div className='container relative z-10 mx-auto mt-10 flex items-center justify-center border-t border-border/50 px-4 pt-6 md:mt-12'>
        <p className='text-xs text-muted-foreground/60'>
          &copy; {new Date().getFullYear()} Stratus. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
