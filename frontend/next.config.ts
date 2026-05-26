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

module.exports = {
  images: {
    remotePatterns: [new URL('https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/**')],
  },
}

export default nextConfig
