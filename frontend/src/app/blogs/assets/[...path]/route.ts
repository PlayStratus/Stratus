import { readFile } from "node:fs/promises"
import path from "node:path"

import { DOCS_ROOT } from "@/lib/blog-docs"

type Props = {
  params: Promise<{ path: string[] }>
}

const MIME_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
}

export const dynamic = "force-dynamic"

function getContentType(filePath: string) {
  return (
    MIME_TYPES[path.extname(filePath).toLowerCase()] ??
    "application/octet-stream"
  )
}

function resolveDocsFilePath(segments: string[]) {
  const filePath = path.resolve(
    DOCS_ROOT,
    ...segments.map((segment) => decodeURIComponent(segment)),
  )
  const relativePath = path.relative(DOCS_ROOT, filePath)

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath === ""
  ) {
    return null
  }

  return filePath
}

export async function GET(_request: Request, { params }: Props) {
  const { path: assetPath } = await params
  const filePath = resolveDocsFilePath(assetPath)

  if (!filePath) {
    return new Response("Not found", { status: 404 })
  }

  try {
    const fileContents = await readFile(/* turbopackIgnore: true */ filePath)

    return new Response(fileContents, {
      headers: {
        "cache-control": "public, max-age=0, must-revalidate",
        "content-type": getContentType(filePath),
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
