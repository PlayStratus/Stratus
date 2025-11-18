type Props = {
  searchParams: Promise<{ game?: string }>
}

export default async function Service({ searchParams }: Props) {
  const params = await searchParams
  const game = params.game

  if (!game) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-between p-24'>
        <p>No service selected</p>
      </div>
    )
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-between p-24'>
      <p>
        This is when we would connect you to our server and you would be able to
        play {game}
      </p>
    </div>
  )
}
