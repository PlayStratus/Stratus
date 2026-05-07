"use client"

import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/components/auth/AuthProvider"
import wordmarkLogo from "@/assets/wordmark-logo.png"

export default function Footer() {
  const { user } = useAuth()

  return (
    <footer className="w-full bg-background border-t py-16 md:py-24 overflow-hidden relative">
      <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10 flex flex-col items-center justify-between gap-12">
        <div className="flex flex-col items-center gap-6">
          <Link href="/" className="group inline-block">
            <Image
              src={wordmarkLogo}
              alt="Stratus"
              className="h-10 md:h-14 w-auto drop-shadow-md transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
          <p className="text-muted-foreground text-center max-w-sm">
            An open source game streaming service.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
          >
            Home
          </Link>

          {user && (
            <Link
              href="/browse"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
            >
              Browse
            </Link>
          )}

          <Link
            href="/about"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
          >
            About
          </Link>
        </nav>

        <div className="w-full flex items-center justify-center pt-8 border-t border-border/50">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Stratus. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
