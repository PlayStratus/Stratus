import { getGames } from "@/lib/actions/games"
import NavClient from "./NavClient"

export default async function Nav() {
  const games = await getGames()
  return <NavClient games={games ?? []} />
}
