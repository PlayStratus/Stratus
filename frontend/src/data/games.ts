export type Game = {
  name: string;
  des: string;
};

const games: Game[] = [
  { name: 'Solitaire', des: "A card game where you organize cards by suit and rank, aiming to clear the table." },
  { name: 'Chess', des: "Play chess!" },
  { name: 'Minecraft', des: "This is a game where the world is made out of blocks!" },
  { name: 'Sudoku', des: "Play Sudoku." },
  { name: 'Minesweeper', des: "Minesweeper is a logic puzzle game." },
];

export default games;
