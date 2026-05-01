import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": [".vercel-blog-docs/**/*"],
    "/blogs/[slug]": [".vercel-blog-docs/**/*"],
    "/blogs/assets/[...path]": [".vercel-blog-docs/**/*"],
  },
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
