import Nav from "@/components/Nav"
import ProtectedShell from "@/components/auth/ProtectedShell"

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ProtectedShell>
      <div className='min-h-screen flex flex-col'>
        <Nav />

        {children}
      </div>
    </ProtectedShell>
  )
}
