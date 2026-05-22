import matter from "gray-matter"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import { DOCS_ROOT } from "@/lib/blog-docs"

export type BlogFrontmatter = {
  title: string
  image: string
  author: string
  tags: string[]
}

export type BlogSummary = {
  slug: string
  title: string
  author: string
  tags: string[]
  imageUrl: string
  searchText: string
}

export type BlogPost = BlogSummary & {
  content: string
  sourcePath: string
  sourceRelativePath: string
}

function toPosixPath(value: string) {
  return value.split(path.sep).join(path.posix.sep)
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replaceAll(/\s+/g, " ").trim()
}

function slugifyFilename(fileName: string) {
  const slug = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")

  if (!slug) {
    throw new Error(`Could not derive a blog slug from "${fileName}".`)
  }

  return slug
}

function isBlogMarkdownFile(fileName: string) {
  const normalizedFileName = fileName.toLowerCase()
  return (
    normalizedFileName.endsWith(".md") && normalizedFileName !== "readme.md"
  )
}

function validateFrontmatter(data: unknown, filePath: string): BlogFrontmatter {
  const source = data as Partial<BlogFrontmatter> | undefined

  if (typeof source?.title !== "string" || source.title.trim() === "") {
    throw new Error(`Missing required "title" frontmatter in "${filePath}".`)
  }

  if (typeof source.author !== "string" || source.author.trim() === "") {
    throw new Error(`Missing required "author" frontmatter in "${filePath}".`)
  }

  if (typeof source.image !== "string" || source.image.trim() === "") {
    throw new Error(`Missing required "image" frontmatter in "${filePath}".`)
  }

  if (source.tags != null && !Array.isArray(source.tags)) {
    throw new Error(`Expected "tags" to be an array in "${filePath}".`)
  }

  const tags = (source.tags ?? []).map((tag) => {
    if (typeof tag !== "string" || tag.trim() === "") {
      throw new Error(
        `Expected "tags" to contain only strings in "${filePath}".`,
      )
    }

    return tag.trim()
  })

  return {
    title: source.title.trim(),
    author: source.author.trim(),
    image: source.image.trim(),
    tags,
  }
}

async function getMarkdownFiles(dir: string): Promise<string[]> {
  let entries

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      console.warn(`Blog docs directory not found: ${dir}`)
      return []
    }

    throw error
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        return getMarkdownFiles(entryPath)
      }

      if (entry.isFile() && isBlogMarkdownFile(entry.name)) {
        return [entryPath]
      }

      return []
    }),
  )

  return files.flat()
}

async function getDocsFiles(dir: string): Promise<string[]> {
  let entries

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      console.warn(`Blog docs directory not found: ${dir}`)
      return []
    }

    throw error
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        return getDocsFiles(entryPath)
      }

      if (entry.isFile()) {
        return [entryPath]
      }

      return []
    }),
  )

  return files.flat()
}

export function resolveDocAssetPath(
  sourceRelativePath: string,
  rawAssetPath: string,
) {
  if (!rawAssetPath || rawAssetPath.startsWith("#")) {
    return null
  }

  if (/^[a-z]+:/i.test(rawAssetPath) || rawAssetPath.startsWith("//")) {
    return null
  }

  const sourceDir = path.posix.dirname(toPosixPath(sourceRelativePath))
  const normalizedAssetPath = rawAssetPath.split(/[?#]/, 1)[0]

  const resolvedPath = rawAssetPath.startsWith("/")
    ? path.posix.normalize(normalizedAssetPath.replace(/^\/+/, ""))
    : path.posix.normalize(path.posix.join(sourceDir, normalizedAssetPath))

  if (
    !resolvedPath ||
    resolvedPath === "." ||
    resolvedPath.startsWith("../") ||
    resolvedPath === ".." ||
    path.posix.isAbsolute(resolvedPath)
  ) {
    throw new Error(
      `Asset path "${rawAssetPath}" escapes the docs directory for "${sourceRelativePath}".`,
    )
  }

  return resolvedPath
}

export function buildBlogAssetUrl(relativeDocsPath: string) {
  return `/blogs/assets/${relativeDocsPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`
}

export function buildBlogPostUrl(relativeDocsPath: string) {
  return `/blogs/${slugifyFilename(path.posix.basename(relativeDocsPath))}`
}

export function resolveDocLinkHref(
  sourceRelativePath: string,
  rawHref: string | undefined,
) {
  if (!rawHref || rawHref.startsWith("#")) {
    return rawHref
  }

  if (/^[a-z]+:/i.test(rawHref) || rawHref.startsWith("//")) {
    return rawHref
  }

  const linkPath = rawHref.split(/[?#]/, 1)[0]
  const linkSuffix = rawHref.slice(linkPath.length)
  const linkExtension = path.posix.extname(linkPath).toLowerCase()

  if (!linkExtension) {
    return rawHref
  }

  const relativeDocsPath = resolveDocAssetPath(sourceRelativePath, rawHref)

  if (!relativeDocsPath) {
    return rawHref
  }

  if (path.posix.extname(relativeDocsPath).toLowerCase() === ".md") {
    return `${buildBlogPostUrl(relativeDocsPath)}${linkSuffix}`
  }

  return `${buildBlogAssetUrl(relativeDocsPath)}${linkSuffix}`
}

function toBlogPost(filePath: string, rawFile: string): BlogPost {
  const parsed = matter(rawFile)
  const frontmatter = validateFrontmatter(parsed.data, filePath)
  const sourceRelativePath = toPosixPath(path.relative(DOCS_ROOT, filePath))
  const resolvedImagePath = resolveDocAssetPath(
    sourceRelativePath,
    frontmatter.image,
  )

  if (!resolvedImagePath) {
    throw new Error(`Missing resolved blog image for "${filePath}".`)
  }

  return {
    slug: slugifyFilename(path.basename(filePath)),
    title: frontmatter.title,
    author: frontmatter.author,
    tags: frontmatter.tags,
    imageUrl: buildBlogAssetUrl(resolvedImagePath),
    searchText: normalizeSearchText(
      [
        frontmatter.title,
        frontmatter.author,
        frontmatter.tags.join(" "),
        parsed.content,
      ].join(" "),
    ),
    content: parsed.content,
    sourcePath: filePath,
    sourceRelativePath,
  }
}

async function loadBlogPosts() {
  const markdownFiles = await getMarkdownFiles(DOCS_ROOT)
  const maybePosts = await Promise.all(
    markdownFiles.map(async (filePath) => {
      try {
        const fileContents = await readFile(filePath, "utf8")
        return toBlogPost(filePath, fileContents)
      } catch (error) {
        console.error(`Skipping blog post "${filePath}".`, error)
        return null
      }
    }),
  )
  const posts = maybePosts.filter((post) => post !== null)

  const slugs = new Set<string>()
  for (const post of posts) {
    if (slugs.has(post.slug)) {
      throw new Error(`Duplicate blog slug "${post.slug}" found in docs.`)
    }

    slugs.add(post.slug)
  }

  return posts.sort((left, right) => left.title.localeCompare(right.title))
}

export async function getAllBlogSummaries(): Promise<BlogSummary[]> {
  const posts = await loadBlogPosts()

  return posts.map(
    ({ content, sourcePath, sourceRelativePath, ...summary }) => summary,
  )
}

export async function getAllBlogSlugs() {
  const posts = await loadBlogPosts()
  return posts.map((post) => post.slug)
}

export async function getAllBlogAssetParams() {
  const files = await getDocsFiles(DOCS_ROOT)

  return files.map((filePath) => ({
    path: toPosixPath(path.relative(DOCS_ROOT, filePath)).split("/"),
  }))
}

export async function getBlogPostBySlug(slug: string) {
  const posts = await loadBlogPosts()
  return posts.find((post) => post.slug === slug) ?? null
}
