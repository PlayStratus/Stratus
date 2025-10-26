import Link from "next/link"

import { GameType } from "../../../data/games"

type Props = {
  game: GameType
}

export default function Game({ game }: Props) {
  return (
    <div className='game'>
      <div className='description'>
        <p>
          {game.name}: <br></br>
          {game.des}
        </p>
      </div>

      <div className='play-button'>
        <Link href={`/browse/${encodeURIComponent(game.name)}`}>View</Link>
      </div>
    </div>
  )
}
