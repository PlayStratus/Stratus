import CreateTable from '@/components/CreateTable'


export default function Service() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-between p-24'>
      <h1 className='text-4xl font-bold'>Connect to the server</h1>
      <CreateTable></CreateTable>    
    </div>
  )
}
