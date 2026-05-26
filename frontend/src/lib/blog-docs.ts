import { existsSync } from "node:fs"
import path from "node:path"

const STAGED_DOCS_ROOT = ".vercel-blog-docs"

function getBlogDocsRoot() {
  if (process.env.BLOG_DOCS_ROOT) {
    return process.env.BLOG_DOCS_ROOT
  }

  if (existsSync(path.resolve(process.cwd(), STAGED_DOCS_ROOT))) {
    return STAGED_DOCS_ROOT
  }

  return "../docs"
}

export const DOCS_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  getBlogDocsRoot(),
)
