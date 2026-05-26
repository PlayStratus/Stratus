import { rm } from "node:fs/promises"
import path from "node:path"

const outDir = path.resolve(process.cwd(), "out")

const excludedRoutes = ["browse", "heart", "play", "signin"]
const generatedRouteArtifacts = excludedRoutes.flatMap((route) => [
  route,
  `${route}.html`,
  `${route}.txt`,
])

await Promise.all(
  generatedRouteArtifacts.map((entry) =>
    rm(path.join(outDir, entry), { force: true, recursive: true }),
  ),
)

console.log("Pruned static export to landing, blogs, and direct-connect.")
