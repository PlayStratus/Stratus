import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import ClientPage from "./ClientPage"

const DEFAULT_URL = "localhost:4433"

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
    <main className='flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-50'>
      <Card className='w-full max-w-2xl border-slate-800 bg-slate-900/90 shadow-2xl'>
        <CardHeader className='space-y-2'>
          <CardTitle className='text-3xl font-semibold tracking-tight'>
            MVP Connection
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form method='GET' className='space-y-6'>
            {error ? (
              <Alert
                variant='destructive'
                className='border-red-500/40 bg-red-950/40'
              >
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
                autoCapitalize='off'
                autoCorrect='off'
                className='border-slate-700 bg-slate-950'
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
                className='min-h-40 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
                placeholder='"Generated TLS certificate: ..."'
              />
            </div>

            <Button type='submit' className='w-full'>
              Open Client
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
