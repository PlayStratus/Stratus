import Nav from "@/components/Nav"
import { getBackendPath } from "@/lib/backend/getBackendPath"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

async function verifyAuth() {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")

  if (!authToken) {
    redirect("/signin")
  }

  try {
    const response = await fetch(getBackendPath("/users/refresh"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken.value}`,
      },
      cache: "no-store",
    })

    const data = await response.json()

    return data
  } catch (error) {
    return redirect("/signin")
  }
}

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await verifyAuth()

  return (
    <>
      <Nav />

      {children}

      <footer className='px-4 py-20 bg-muted/30'>
        <div className='container mx-auto'>
          <h2 className='text-3xl md:text-5xl font-bold mb-6'>Stratus</h2>
        </div>
      </footer>
    </>
  )
}
