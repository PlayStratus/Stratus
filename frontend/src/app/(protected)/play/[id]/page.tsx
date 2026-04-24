import { getBackendPath } from "@/lib/backend/getBackendPath"

import Client from "./Client"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PlayPage({ params }: Readonly<Props>) {
  const { id } = await params

  const response = await fetch(getBackendPath(`/games/${id}`))

  if (!response.ok) {
    return <div className='flex-1'>Game not found</div>
  }

  const game = await response.json()

  return (
    <div className='flex-1 flex'>
      <Client id={id} title={game.title} />
    </div>
  )
}
