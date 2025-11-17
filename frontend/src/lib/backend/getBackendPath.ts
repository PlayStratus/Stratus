export const getBackendPath = (path: string) => {
  const backendPath =
    process.env.NEXT_PUBLIC_BACKEND_PATH || "http://localhost:4000"

  return `${backendPath}${path}`
}
