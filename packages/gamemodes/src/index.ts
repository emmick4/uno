import type { GamemodePlugin } from '@uno/shared'
import { originalGamemode } from './original'
import { harryPotterGamemode } from './harry-potter'

/** Registry of all available gamemodes */
export const gamemodes: Record<string, GamemodePlugin> = {
  original: originalGamemode,
  'harry-potter': harryPotterGamemode,
}

export function getGamemode(id: string): GamemodePlugin {
  const gm = gamemodes[id]
  if (!gm) throw new Error(`Unknown gamemode: ${id}`)
  return gm
}

export { originalGamemode } from './original'
export { harryPotterGamemode } from './harry-potter'
