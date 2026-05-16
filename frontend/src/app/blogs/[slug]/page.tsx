import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Children, isValidElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import Nav from "@/components/Nav"
import { buttonVariants } from "@/components/ui/button"
import { ExpandableImage } from "@/components/ui/expandable-image"

import {
  buildBlogAssetUrl,
  getBlogPostBySlug,
  resolveDocLinkHref,
  resolveDocAssetPath,
} from "@/lib/blogs"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  return {
    title: post?.title ?? "Blog Post",
  }
}

function hasMarkdownImage(children: ReactNode) {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ node?: { tagName?: string } }>(child)) {
      return false
    }

    return child.props.node?.tagName === "img"
  })
}

export const dynamic = "force-dynamic"

export default async function BlogPostPage({ params }: Readonly<Props>) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return (
    <main className='min-h-screen'>
      <Nav hideSearchBar />

      <article className='container mx-auto max-w-5xl px-4 py-16'>
        <Link
          href='/#Blogs'
          className={buttonVariants({ variant: "outline" }) + " mb-8 w-fit"}
        >
          ← Back to Blogs
        </Link>

        <header className='mb-10 grid gap-6'>
          <div className='flex flex-wrap gap-2'>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className='rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'
              >
                {tag}
              </span>
            ))}
          </div>

          <div className='grid gap-3'>
            <h1 className='text-4xl font-bold tracking-tight md:text-6xl'>
              {post.title}
            </h1>
            <p className='text-sm uppercase tracking-[0.22em] text-muted-foreground'>
              {post.author}
            </p>
          </div>
        </header>

        <div className='grid gap-6 text-base leading-8 text-foreground/95'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className='mt-6 text-4xl font-bold tracking-tight'>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className='mt-8 text-3xl font-semibold tracking-tight'>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className='mt-6 text-2xl font-semibold tracking-tight'>
                  {children}
                </h3>
              ),
              p: ({ children }) => {
                const Component = hasMarkdownImage(children) ? "div" : "p"

                return (
                  <Component className='text-base leading-8 text-foreground/90'>
                    {children}
                  </Component>
                )
              },
              ul: ({ children }) => (
                <ul className='list-disc space-y-2 pl-6 text-foreground/90'>
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className='list-decimal space-y-2 pl-6 text-foreground/90'>
                  {children}
                </ol>
              ),
              li: ({ id, children }) => <li id={id}>{children}</li>,
              blockquote: ({ children }) => (
                <blockquote className='rounded-r-xl border-l-4 border-primary/50 bg-card/50 px-4 py-3 text-muted-foreground'>
                  {children}
                </blockquote>
              ),
              a: ({ id, href, children }) => {
                const resolvedHref = resolveDocLinkHref(
                  post.sourceRelativePath,
                  href,
                )

                return (
                  <a
                    id={id}
                    href={resolvedHref}
                    className='font-medium text-primary underline underline-offset-4'
                  >
                    {children}
                  </a>
                )
              },
              code: ({ className, children }) => (
                <code
                  className={
                    "rounded bg-card px-1.5 py-0.5 text-sm " + (className ?? "")
                  }
                >
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className='overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-4 text-sm leading-7'>
                  {children}
                </pre>
              ),
              img: ({ src, alt }) => {
                let resolvedSrc = typeof src === "string" ? src : ""

                if (typeof src === "string") {
                  const relativeAssetPath = resolveDocAssetPath(
                    post.sourceRelativePath,
                    src,
                  )
                  if (relativeAssetPath) {
                    resolvedSrc = buildBlogAssetUrl(relativeAssetPath)
                  }
                }

                return (
                  <ExpandableImage
                    src={resolvedSrc}
                    alt={alt ?? "Blog image"}
                    width={1200}
                    height={800}
                    showCaption={true}
                  />
                )
              },
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </main>
  )
}
