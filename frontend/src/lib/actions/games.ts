import { GameType } from "../types"
import { getBackendPath } from "@/lib/backend/getBackendPath"


export async function getGames() {
  try {
    const response = await fetch(getBackendPath("/games"), {
      method: "GET",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error body:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GameType[] = await response.json();

    return data;
  } catch (error) {
    
  }
}

export async function getGameById(id: string) {
  try {
    const response = await fetch(getBackendPath(`/games/${id}`), {
      method: "GET",
      headers: {
        
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error body:", errorText);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data: GameType = await response.json();
    if (!data) {
    throw new Error(`Game with id ${id} not found`)
    }
    return data;
  } catch (error) {
    return null;
  }
  
}


