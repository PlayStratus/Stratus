import Nav from "@/components/Nav"
import ProtectedShell from "@/components/auth/ProtectedShell"
import { isStaticExport } from "@/lib/static-export"

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  if (isStaticExport) {
    return null
  }

  return (
    <ProtectedShell>
      <div className='flex min-h-0 flex-1 flex-col'>
        <Nav />

        {children}
      </div>
    </ProtectedShell>
  )
}
