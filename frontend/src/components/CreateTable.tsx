import games from '../data/games';
import CreateGame from "./CreateGame"

export default function Nav() {
  return (
    <div className='table'>
      {games.map((games, index) => <CreateGame games={games} key={index}/>)}
                    
    </div>
  )
}
