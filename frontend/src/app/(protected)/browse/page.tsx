import CreateTable from "@/app/(protected)/browse/GamesTable"

export default function Browse() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-between p-24'>
      <h1 className='text-4xl font-bold'>Connect to the server</h1>
      <CreateTable />
    </div>
  )
}
