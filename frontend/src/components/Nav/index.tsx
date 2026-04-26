import { getGames } from "@/lib/actions/games"
import NavClient from "./NavClient"

type Props = {
  revealOnScroll?: boolean
}

export default async function Nav({ revealOnScroll = false }: Readonly<Props>) {
  const games = await getGames()
  return <NavClient games={games ?? []} revealOnScroll={revealOnScroll} />
}
