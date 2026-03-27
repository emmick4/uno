import type { Card, CardColor, CardDefinition } from '@uno/shared'
import { CARD_COLORS } from '@uno/shared'

const colors: CardColor[] = [...CARD_COLORS]

/**
 * Harry Potter Uno deck.
 * Differences from Original:
 * - Draw 3 instead of Draw 2
 * - Invisibility cards (2 per color, wild) — can block any card, even out of turn
 * - Howler cards (1 per color) — lets you see another player's hand
 * - Wild Draw 4 still exists
 * - Regular numbers and reverse/skip remain the same
 */
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
  // Two of each skip, reverse per color
  ...colors.flatMap((color) =>
    ['skip', 'reverse'].map((value) => ({
      color,
      value,
      count: 2,
    })),
  ),
  // Draw 3 instead of Draw 2 — two per color
  ...colors.map((color) => ({
    color,
    value: 'draw3',
    count: 2,
  })),
  // Howler — one per color (lets you see someone's hand)
  ...colors.map((color) => ({
    color,
    value: 'howler',
    count: 1,
  })),
  // Invisibility — 2 wild cards (block anything, even out of turn)
  { color: 'wild' as CardColor, value: 'invisibility', count: 4 },
  // Standard wilds
  { color: 'wild' as CardColor, value: 'wild', count: 4 },
  // Wild Draw 4
  { color: 'wild' as CardColor, value: 'wild-draw4', count: 4 },
]

/** Build the HP deck */
export function buildDeck(numDecks: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < numDecks; d++) {
    for (const def of cardDefinitions) {
      for (let i = 0; i < def.count; i++) {
        cards.push({
          id: `${def.color}-${def.value}-${d}-${i}`,
          color: def.color,
          value: def.value,
          gamemode: 'harry-potter',
        })
      }
    }
  }
  return cards
}
