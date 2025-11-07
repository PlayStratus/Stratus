export const getBackendPath = (path: string) => {
  const environment = process.env.NODE_ENV || "development"

  const baseUrl =
    environment === "production"
      ? "https://stratus-backend.onrender.com"
      : "http://localhost:4000"

  return `${baseUrl}${path}`
}
