import { Game } from '../data/games';
type Props = {
  games: Game;
};

export default function CreateGame({ games }: Props) {
  return (
    <div className='game'>
    <div className='description'> 
        <p>{games.name}: <br></br>{games.des}</p>
    </div>
      
      <div className='play-button'>
        <a href={`/service?game=${encodeURIComponent(games.name)}`}>Play Game</a>
      </div>
    </div>
  );
}
