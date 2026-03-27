import type { Card, CardColor, CardDefinition } from '@uno/shared'
import { CARD_COLORS } from '@uno/shared'

const colors: CardColor[] = [...CARD_COLORS]

/** Card definitions for a standard 108-card Uno deck */
export const cardDefinitions: CardDefinition[] = [
  // One 0 per color
  ...colors.map((color) => ({ color, value: '0', count: 1 })),
  // Two of each 1-9 per color
  ...colors.flatMap((color) =>
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((value) => ({
      color,
      value,
      count: 2,
    })),
  ),
  // Two of each action per color
  ...colors.flatMap((color) =>
    ['skip', 'reverse', 'draw2'].map((value) => ({
      color,
      value,
      count: 2,
    })),
  ),
  // Four wilds and four wild draw 4s
  { color: 'wild' as CardColor, value: 'wild', count: 4 },
  { color: 'wild' as CardColor, value: 'wild-draw4', count: 4 },
]

/** Build a deck from card definitions, repeated for multiple decks */
export function buildDeck(numDecks: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < numDecks; d++) {
    for (const def of cardDefinitions) {
      for (let i = 0; i < def.count; i++) {
        cards.push({
          id: `${def.color}-${def.value}-${d}-${i}`,
          color: def.color,
          value: def.value,
          gamemode: 'original',
        })
      }
    }
  }
  return cards
}
