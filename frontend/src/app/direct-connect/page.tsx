import type { Metadata } from "next"

import Nav from "@/components/Nav"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import ClientPage from "./ClientPage"

const DEFAULT_URL = "localhost:4433"

export const metadata: Metadata = {
  title: "Direct Connect",
}

type Props = {
  searchParams: Promise<{
    url?: string
    tls_cert?: string
    error?: string
  }>
}

export default async function MVPPage({ searchParams }: Readonly<Props>) {
  const params = await searchParams
  const url = params.url?.trim() || DEFAULT_URL
  const tlsCert = params.tls_cert?.trim() || ""
  const error = params.error?.trim() || ""

  if (url && tlsCert && !error) {
    return <ClientPage url={url} tlsCert={tlsCert} />
  }

  return (
    <>
      <Nav hideSearchBar />

      <main className='flex flex-1 items-center bg-background px-4 py-12 md:py-16'>
        <section className='container mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(360px,520px)]'>
          <div className='max-w-2xl space-y-5'>
            <p className='text-sm font-semibold uppercase tracking-widest text-muted-foreground'>
              Direct Connect
            </p>

            <h1 className='text-4xl font-bold tracking-tight text-foreground md:text-5xl'>
              Connect to a Stratus streaming server
            </h1>

            <p className='text-lg leading-8 text-muted-foreground'>
              Use a host address and TLS fingerprint to manually connect to a
              session on a streaming server. You can run the Stratus streaming
              server locally by cloning the <a
              href='https://github.com/PlayStratus/Stratus'
              target='_blank'
              rel='noreferrer'
              className='font-medium text-primary underline underline-offset-4'
              >GitHub repository</a> and following the instructions in <a
              href='https://github.com/PlayStratus/Stratus/blob/main/stratusd/README.md#development-setup'
              target='_blank'
              rel='noreferrer'
              className='font-medium text-primary underline underline-offset-4'
              >stratusd/README.md</a>.
            </p>
          </div>

          <Card className='border-border/80 bg-card/80 shadow-xl shadow-black/20 backdrop-blur'>
            <CardHeader className='space-y-2'>
              <CardTitle className='text-2xl font-semibold tracking-tight'>
                Connection Details
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form method='GET' className='space-y-6'>
                {error ? (
                  <Alert variant='destructive'>
                    <AlertTitle>Connection error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className='space-y-2'>
                  <Label htmlFor='url'>URL</Label>
                  <Input
                    id='url'
                    name='url'
                    type='text'
                    defaultValue={url}
                    required
                    spellCheck={false}
                    autoCapitalize='none'
                    autoCorrect='off'
                    placeholder='localhost:4433'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tls-cert'>TLS Fingerprint</Label>
                  <textarea
                    id='tls-cert'
                    name='tls_cert'
                    defaultValue={tlsCert}
                    required
                    spellCheck={false}
                    className='min-h-40 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'
                    placeholder='"Generated TLS certificate: ..."'
                  />
                </div>

                <Button type='submit' size='lg' className='w-full'>
                  Open Client
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  )
}
