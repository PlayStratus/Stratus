import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

type Props = {
  params: Promise<{ id: string }>
}

export default async function Service({ params }: Props) {
  const { id } = await params

  return (
    <div className='flex min-h-screen flex-col items-center justify-between p-24'>
      <p>Description of {id}</p>

      <Link href={`/play/${id}`} className={buttonVariants()}>
        Play
      </Link>
    </div>
  )
}
