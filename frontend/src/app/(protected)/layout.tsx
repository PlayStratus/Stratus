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

      <footer className='px-4 py-20 bg-muted/30'>
        <div className='container mx-auto'>
          <h2 className='text-3xl md:text-5xl font-bold mb-6'>Stratus</h2>
        </div>
      </footer>
    </>
  )
}
