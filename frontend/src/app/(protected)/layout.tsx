import Nav from "@/components/nav"

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
