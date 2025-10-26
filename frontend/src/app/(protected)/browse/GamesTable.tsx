import games from "@/data/games"
import CreateGame from "./Game"

export default function GamesTable() {
  return (
    <div className='table'>
      {games.map((game, index) => (
        <CreateGame game={game} key={index} />
      ))}
    </div>
  )
}
