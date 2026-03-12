import Client from "./Client"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PlayPage({ params }: Readonly<Props>) {
  const { id } = await params

  // TODO: Verify with the backend that the game id exists

  return (
    <div className='flex-1'>
      <div className='mx-auto'>Game ID: {id}</div>
    </div>
  )
  // return <Client />
}
