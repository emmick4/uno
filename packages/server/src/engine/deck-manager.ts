import type { Card } from '@uno/shared'

/** Fisher-Yates shuffle */
export function shuffle<T>(array: T[]): T[] {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Draw cards from the draw pile, reshuffling discard if needed */
export function drawCards(
  count: number,
  drawPile: Card[],
  discardPile: Card[],
): { drawn: Card[]; drawPile: Card[]; discardPile: Card[] } {
  const drawn: Card[] = []
  let pile = [...drawPile]
  let discard = [...discardPile]

  for (let i = 0; i < count; i++) {
    if (pile.length === 0) {
      if (discard.length <= 1) break // Can't reshuffle, no cards left
      const topDiscard = discard[discard.length - 1]
      pile = shuffle(discard.slice(0, -1))
      discard = [topDiscard]
    }
    drawn.push(pile.pop()!)
  }

  return { drawn, drawPile: pile, discardPile: discard }
}
