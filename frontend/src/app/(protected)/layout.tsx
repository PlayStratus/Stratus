import Nav from "@/components/Nav"

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <Nav />

      {children}
    </>
  )
}
