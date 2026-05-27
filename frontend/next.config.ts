import type { NextConfig } from "next"

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"

const imageConfig: NonNullable<NextConfig["images"]> = {
  remotePatterns: [
    new URL("https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/**"),
  ],
  minimumCacheTTL: 2678400,
  deviceSizes: [640, 768, 1024, 1280, 1536],
  imageSizes: [64, 128, 256, 384, 512, 720],
  qualities: [70],
  formats: ["image/webp"],
}

const nextConfig: NextConfig = {
  images: imageConfig,
  ...(isStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: {
          ...imageConfig,
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
