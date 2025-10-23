'use client';
import { useSearchParams } from 'next/navigation';

export default function Service() {
  const searchParams = useSearchParams();
  const game = searchParams.get('game');

  return (
    <div className='flex min-h-screen flex-col items-center justify-between p-24'>
      <p>This is when we would connect you to a our server and you would be able to play {game}</p>
    </div>
  );
}
