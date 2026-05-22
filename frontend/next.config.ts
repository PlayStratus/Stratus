import type { NextConfig } from "next"

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
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
