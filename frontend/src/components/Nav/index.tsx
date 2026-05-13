import { getGames } from "@/lib/actions/games"

import NavClient from "./NavClient"

type Props = {
  revealOnScroll?: boolean
  hideSearchBar?: boolean
}

export default async function Nav({
  revealOnScroll = false,
  hideSearchBar = false,
}: Readonly<Props>) {
  const games = await getGames()
  return (
    <NavClient
      games={games ?? []}
      revealOnScroll={revealOnScroll}
      hideSearchBar={hideSearchBar}
    />
  )
}
