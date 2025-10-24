type Props = {
  params: Promise<{ id: string }>
}

export default async function Service({ params }: Props) {
  const { id } = await params

  return (
    <div className='flex min-h-screen flex-col items-center justify-between p-24'>
      <p>
        This is when we would connect you to our server and you would be able to
        play {id}
      </p>
    </div>
  )
}
