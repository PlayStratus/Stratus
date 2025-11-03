import { GameType } from "../types"

const games: GameType[] = [
  {
    id: "k8f3z1q9u2ht",
    name: "Solitaire",
    description:
      "A single-player card game where you arrange cards into suit-based foundations, clearing the tableau through strategic moves and sequencing.",
    developer: "Microsoft",
    genres: ["Card", "Puzzle", "Casual"],
  },
  {
    id: "b7p4x0n6r9sy",
    name: "Chess",
    description:
      "A two-player strategy board game where each side maneuvers pieces to checkmate the opponent's king.",
    developer: "Chess.com",
    genres: ["Strategy", "Board", "Multiplayer"],
  },
  {
    id: "m2c8v5d1t4jg",
    name: "Minecraft",
    description:
      "A sandbox building and exploration game where you mine resources, craft tools, and build structures in a procedurally generated world.",
    developer: "Mojang Studios",
    genres: ["Sandbox", "Adventure", "Survival", "Creative"],
  },
  {
    id: "h9l6q3w8z2bf",
    name: "Sudoku",
    description:
      "A logic-based number-placement puzzle: fill a 9x9 grid so each row, column, and 3x3 box contains digits 1–9.",
    developer: "Brainium Studios",
    genres: ["Puzzle", "Logic", "Casual"],
  },
  {
    id: "s1n7a4k0u5pv",
    name: "Minesweeper",
    description:
      "A grid-based logic puzzle where you uncover safe cells while using numeric clues to avoid hidden mines.",
    developer: "Microsoft",
    genres: ["Puzzle", "Logic", "Casual"],
  },
  {
    id: "t3r8y6m1c5qd",
    name: "Tetris",
    description:
      "A falling-block puzzle where you rotate and place tetrominoes to complete and clear horizontal lines before the stack reaches the top.",
    developer: "The Tetris Company",
    genres: ["Puzzle", "Arcade", "Action"],
  },
  {
    id: "z4x9v2b7n6hj",
    name: "Checkers",
    description:
      "A two-player board game of diagonal moves and captures; crowned pieces become kings and can move backward.",
    developer: "ClassicGames.io",
    genres: ["Strategy", "Board", "Multiplayer"],
  },
  {
    id: "p0q3w8e5r1ty",
    name: "Poker",
    description:
      "A family of card games centered on betting, bluffing, and hand rankings; popular variants include Texas Hold'em and Omaha.",
    developer: "PokerStars",
    genres: ["Card", "Casino", "Multiplayer"],
  },
  {
    id: "n6m2b8v4c1xz",
    name: "Blackjack",
    description:
      "A casino card game where players attempt to beat the dealer by getting a hand value as close to 21 as possible without going over.",
    developer: "21 Studios",
    genres: ["Card", "Casino", "Casual"],
  },
  {
    id: "g5h2j9k0l8sd",
    name: "Monopoly",
    description:
      "A property-trading board game where players buy, trade, and develop properties to collect rent and bankrupt opponents.",
    developer: "Hasbro",
    genres: ["Board", "Strategy", "Multiplayer"],
  },
]

export async function getGames() {
  return games
}

export async function getGameById(id: string) {
  const game = games.find((game) => game.id === id)

  if (!game) {
    throw new Error(`Game with id ${id} not found`)
  }

  return game
}
